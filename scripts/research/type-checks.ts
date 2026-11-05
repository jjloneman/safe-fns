import { execFile } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";

import type { TypeScriptVersion } from "../lib/typescript-versions.ts";
import type { TypeCheckFunction } from "./type-check-cases.ts";
import type { CompilerRun } from "./type-check-table.ts";

import { TYPESCRIPT_VERSIONS } from "../lib/typescript-versions.ts";
import { readJsonFile } from "./json.ts";
import { describeError, printPrefixed } from "./logging.ts";
import {
  TYPE_CHECK_FIXTURES,
  TYPE_CHECK_FUNCTIONS,
} from "./type-check-cases.ts";
import {
  findOrphanTables,
  parseTscErrors,
  renderTypeChecks,
  toCheckFile,
  toTableFile,
} from "./type-check-table.ts";

/*
 * `pnpm research:types`: compiles each planned type helper's cases, and the
 * compared libraries', with every consumer TypeScript version, and writes
 * `research/audits/<helper>.md`.
 *
 * - Run `pnpm --dir research/types install` first: the compared libraries
 *   live in that pnpm root.
 *
 * - `--check` compares instead of writing, and fails on any difference, or on
 *   a committed table whose helper is gone.
 *
 * - It runs on the host, not in a container: the compilers are the root's
 *   pinned `typescript-<version>` aliases, and the libraries are
 *   `research/`'s, so the lockfiles pin every input.
 */

const AUDITS_DIR = fileURLToPath(
  new URL("../../research/audits/", import.meta.url)
);

/** The planned helpers, each copied beside the checks that import it. */
const PLANNED_DIR = fileURLToPath(
  new URL("../../research/types/", import.meta.url)
);

/** The compared type-only libraries, in `research/types/`'s own pnpm root. */
const TYPES_MODULES = fileURLToPath(
  new URL("../../research/types/node_modules/", import.meta.url)
);

const ROOT_MODULES = fileURLToPath(
  new URL("../../node_modules/", import.meta.url)
);

/**
 * Where the check files are written, inside `research/types/node_modules`, so
 * their imports resolve the compared libraries.
 */
const WORK_DIR = path.join(TYPES_MODULES, ".cache", "type-checks");

/** The check files one program compiles, and the module they import. */
type CheckGroup = {
  /**
   * The check files.
   *
   * @example `["CamelCase/0-0.ts", "CamelCase/1-0.ts"]`
   */
  files: string[];

  /**
   * The module every check in the group imports as `H`, which the program's
   * errors are tagged with.
   *
   * @example "./camel-case"
   */
  module: string;
};

/** Whether a run compares the tables rather than writing them. */
type CheckMode = {
  /**
   * Compare against the committed tables, failing on any difference.
   *
   * @example true
   */
  isCheck: boolean;
};

/** One compiler, and the groups of check files it compiles. */
type CompilerPrograms = {
  /**
   * The consumer TypeScript version to compile with.
   *
   * @example `TYPESCRIPT_VERSIONS[0]`
   */
  compiler: TypeScriptVersion;

  /**
   * Every group, each compiled as a program of its own.
   *
   * @example `[{ files: ["CamelCase/0-0.ts"], module: "./camel-case" }]`
   */
  groups: readonly CheckGroup[];
};

/** One group of check files, and how to compile it as its own program. */
type ProgramRun = {
  /**
   * The config file to write for the program, inside the check directory.
   *
   * @example "tsconfig.typescript-4.9.0.json"
   */
  configFile: string;

  /**
   * The group of check files the program compiles.
   *
   * @example `{ files: ["PartialDeep/1-3.ts"], module: "./partial-deep" }`
   */
  group: CheckGroup;

  /**
   * Whether the compiler has `moduleResolution: "bundler"`.
   *
   * @example true
   */
  hasBundler: boolean;

  /**
   * The compiler's package directory, holding `bin/tsc`.
   *
   * @example "/repo/node_modules/typescript-4.9"
   */
  packageDir: string;
};

/** Print one line, prefixed with the script's name. */
function log(message: string): void {
  console.log(`[type-checks] ${message}`);
}

/** Read an installed package's version. */
function packageVersion(packageDir: string): string {
  const manifest = readJsonFile(path.join(packageDir, "package.json"));

  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("version" in manifest) ||
    typeof manifest.version !== "string"
  ) {
    throw new Error(`${packageDir} has no version`);
  }

  return manifest.version;
}

/** Read a committed table, or `undefined` if there is none. */
function readCommitted(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/** Read what a failed child process wrote to one stream, or `""`. */
function readOutput({
  error,
  key,
}: {
  error: unknown;
  key: "stderr" | "stdout";
}): string {
  if (error instanceof Error && key in error) {
    const output: unknown = Reflect.get(error, key);

    return typeof output === "string" ? output : "";
  }

  return "";
}

/** Read each compared library's installed version, by its column name. */
function readToolVersions(
  checkedFunction: TypeCheckFunction
): Map<string, string> {
  return new Map(
    checkedFunction.tools
      .filter(({ sourceFiles }) => sourceFiles === undefined)
      .map(({ module, name }) => [
        name,
        packageVersion(path.join(TYPES_MODULES, module)),
      ])
  );
}

/**
 * Run one compiler over each group of check files, each in its own program
 * and all at once, returning everything it reported.
 *
 * - `tsc` reports no semantic errors once any file has a syntax error, so a
 *   library the compiler can't parse would otherwise read as a pass for every
 *   other column; each library's checks, and each planned helper's, compile
 *   apart.
 *
 * - It resolves with `bundler` where the version has it, and `node` otherwise
 *   (4.9).
 */
async function runCompiler({
  compiler,
  groups,
}: CompilerPrograms): Promise<CompilerRun> {
  const packageDir = path.join(ROOT_MODULES, compiler.packageName);
  const hasBundler = compiler.resolutionModes.some(
    ({ name }) => name === "bundler"
  );

  const errorsByGroup = await Promise.all(
    groups.map((group, groupIndex) =>
      runProgram({
        configFile: `tsconfig.${compiler.packageName}.${String(groupIndex)}.json`,
        group,
        hasBundler,
        packageDir,
      })
    )
  );

  return { errors: errorsByGroup.flat(), version: packageVersion(packageDir) };
}

/**
 * Compile one group of check files as a program of its own.
 *
 * @returns the compiler errors it reported, each tagged with the group's
 * module, so an error in a shared file counts only against that module.
 */
async function runProgram({
  configFile,
  group,
  hasBundler,
  packageDir,
}: ProgramRun): Promise<CompilerRun["errors"]> {
  writeFileSync(
    path.join(WORK_DIR, configFile),
    JSON.stringify({
      compilerOptions: {
        lib: ["es2022"],
        module: "esnext",
        moduleResolution: hasBundler ? "bundler" : "node",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: "es2022",
        types: [],
      },
      files: group.files,
    })
  );

  const errors = parseTscErrors(
    await runTsc({
      args: [
        path.join(packageDir, "bin", "tsc"),
        "--project",
        configFile,
        "--pretty",
        "false",
      ],
    })
  );

  return errors.map((error) => ({ ...error, program: group.module }));
}

/**
 * Run `tsc`, returning its output whether or not it found errors.
 *
 * - A failed run counts only when it printed a compiler error; a run that
 *   failed some other way, such as a missing binary or a crash, throws with
 *   what it wrote to stderr, rather than reading as a clean pass.
 */
async function runTsc({ args }: { args: readonly string[] }): Promise<string> {
  try {
    // `execFile` has no `stdio` option: it always pipes stdout and stderr,
    // so nothing the compiler prints reaches the terminal.
    const { stdout } = await promisify(execFile)(process.execPath, args, {
      cwd: WORK_DIR,
      encoding: "utf8",
    });

    return stdout;
  } catch (error) {
    const stdout = readOutput({ error, key: "stdout" });

    if (parseTscErrors(stdout).length > 0) {
      return stdout;
    }

    throw new Error(
      `${String(args[0])} failed without a compiler error: ${readOutput({ error, key: "stderr" }).trim()}`,
      { cause: error }
    );
  }
}

/** Write the check files, compile them, then write or compare each table. */
async function writeAndCompare({ isCheck }: CheckMode): Promise<void> {
  const groups = writeCheckFiles();
  const fileCount = groups.flatMap(({ files }) => files).length;
  const runs: CompilerRun[] = [];

  // One compiler at a time, so at most one program per group runs at once.
  for (const compiler of TYPESCRIPT_VERSIONS) {
    log(`compiling ${fileCount} checks with ${compiler.packageName}`);
    runs.push(await runCompiler({ compiler, groups }));
  }

  const tables = TYPE_CHECK_FUNCTIONS.map((checkedFunction) => ({
    file: toTableFile(checkedFunction.name),
    markdown: renderTypeChecks({
      checkedFunction,
      runs,
      toolVersions: readToolVersions(checkedFunction),
    }),
    name: checkedFunction.name,
  }));

  if (!isCheck) {
    for (const { file, markdown } of tables) {
      writeFileSync(path.join(AUDITS_DIR, file), markdown);
      log(`wrote research/audits/${file}`);
    }

    return;
  }

  const staleTables = tables
    .filter(
      ({ file, markdown }) =>
        readCommitted(path.join(AUDITS_DIR, file)) !== markdown
    )
    .map(({ file }) => file);

  const orphanTables = findOrphanTables({
    committed: readdirSync(AUDITS_DIR).map((file) => ({
      file,
      text: readFileSync(path.join(AUDITS_DIR, file), "utf8"),
    })),
    expectedFiles: tables.map(({ file }) => file),
  });

  if (staleTables.length > 0 || orphanTables.length > 0) {
    log(
      `stale: ${[...staleTables, ...orphanTables].join(", ")}; run pnpm research:types and remove any table whose helper is gone`
    );
    process.exitCode = 1;

    return;
  }

  log("every type-check table is up to date");
}

/**
 * Write every check file.
 *
 * @returns their paths, grouped by the program each compiles in: one per
 * module, so each compared library and each planned helper compiles apart.
 */
function writeCheckFiles(): CheckGroup[] {
  rmSync(WORK_DIR, { force: true, recursive: true });
  mkdirSync(WORK_DIR, { recursive: true });

  // Only the helpers' own `.ts` files: the directory is also a pnpm root.
  for (const entry of readdirSync(PLANNED_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      copyFileSync(
        path.join(PLANNED_DIR, entry.name),
        path.join(WORK_DIR, entry.name)
      );
    }
  }

  const checks = TYPE_CHECK_FUNCTIONS.flatMap(({ cases, name, tools }) => {
    mkdirSync(path.join(WORK_DIR, name), { recursive: true });

    return tools.flatMap(({ exportName, module }, toolIndex) =>
      cases.map(({ assertion }, caseIndex) => {
        const file = toCheckFile({ caseIndex, functionName: name, toolIndex });
        const specifier = module.startsWith("./") ? `.${module}` : module;

        writeFileSync(
          path.join(WORK_DIR, file),
          [
            `import type { ${exportName} as H } from "${specifier}";`,
            TYPE_CHECK_FIXTURES,
            `export type Check = Expect<${assertion}>;`,
            "",
          ].join("\n")
        );

        return { file, module };
      })
    );
  });

  const groupsByModule = checks.reduce<Map<string, CheckGroup>>(
    (moduleGroups, { file, module }) => {
      const group = moduleGroups.get(module) ?? { files: [], module };
      group.files.push(file);
      moduleGroups.set(module, group);

      return moduleGroups;
    },
    new Map()
  );

  return [...groupsByModule.values()];
}

/** Run every check, then write or compare every table. */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: "boolean" } } });

  try {
    await writeAndCompare({ isCheck: values.check === true });
  } finally {
    rmSync(WORK_DIR, { force: true, recursive: true });
  }
}

try {
  await main();
} catch (error) {
  printPrefixed({
    message: describeError(error),
    prefix: "[type-checks]",
    print: (line) => {
      console.error(line);
    },
  });
  process.exitCode = 1;
}
