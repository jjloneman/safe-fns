/*
 * Packs the built package and installs it into a scratch consumer project, the
 * way npm would, then proves it is usable there.
 *
 * - The tarball holds no test files.
 *
 * - `test/consumer/types.ts` typechecks against every supported TypeScript
 *   version, in every module resolution mode that version supports.
 *
 * - `test/consumer/smoke.ts` loads every entry via both `import` and `require`.
 *
 * - Run through `pnpm test:consumer`, which builds first.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

type ResolutionMode = (typeof resolutionModes)[keyof typeof resolutionModes];

type TypeScriptVersion = {
  /** The dev-dependency alias the compiler is installed under. */
  packageName: string;

  /** The resolution modes this version understands. */
  resolutionModes: readonly ResolutionMode[];
};

const repoRoot = path.resolve(import.meta.dirname, "..");
const fixtureDir = path.join(repoRoot, "test/consumer");

/*
 * Each mode compiles the fixture under the file extensions that mode treats
 * differently.
 *
 * - `node16` checks both a CommonJS (`.cts`) and an ES module (`.mts`)
 *   importer, since each resolves a different `exports` condition.
 */
const resolutionModes = {
  bundler: {
    files: ["types.ts"],
    flags: ["--module", "esnext", "--moduleResolution", "bundler"],
    name: "bundler",
  },
  node10: {
    files: ["types.ts"],
    flags: ["--module", "commonjs", "--moduleResolution", "node"],
    name: "node10",
  },
  node16: {
    files: ["types.cts", "types.mts"],
    flags: ["--module", "node16", "--moduleResolution", "node16"],
    name: "node16",
  },
} as const;

const { bundler, node10, node16 } = resolutionModes;

/*
 * The consumer TypeScript support matrix.
 *
 * - `bundler` resolution arrived in 5.0.
 *
 * - `node10` resolution is deprecated in 6.0 and removed in 7.0.
 */
const typeScriptVersions: TypeScriptVersion[] = [
  { packageName: "typescript-4.9", resolutionModes: [node10, node16] },
  { packageName: "typescript-5.0", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript-5.4", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript-5.9", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript-7.0", resolutionModes: [bundler, node16] },
];

const sharedCompilerFlags = [
  "--noEmit",
  "--strict",
  "--target",
  "es2022",
  "--lib",
  "es2022",
];

const repoRequire = createRequire(import.meta.url);

function copyFixtures(consumerDir: string): void {
  const typesFixture = path.join(fixtureDir, "types.ts");

  for (const file of ["types.ts", "types.cts", "types.mts"]) {
    copyFileSync(typesFixture, path.join(consumerDir, file));
  }

  copyFileSync(
    path.join(fixtureDir, "smoke.ts"),
    path.join(consumerDir, "smoke.ts")
  );

  // Makes `smoke.ts` an ES module when Node strips its types.
  writeFileSync(
    path.join(consumerDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module" })}\n`
  );
}

function packInto(consumerDir: string): void {
  const packDir = path.join(consumerDir, "pack");
  const installDir = path.join(consumerDir, "node_modules/safe-fns");

  mkdirSync(installDir, { recursive: true });
  run("pnpm", ["pack", "--pack-destination", packDir], repoRoot);

  const [tarball] = readdirSync(packDir);

  if (tarball === undefined) {
    throw new Error("pnpm pack produced no tarball");
  }

  run(
    "tar",
    [
      "-xzf",
      path.join(packDir, tarball),
      "-C",
      installDir,
      "--strip-components",
      "1",
    ],
    consumerDir
  );

  const testFiles = readdirSync(installDir, { recursive: true }).filter(
    (file) => /\.test(?:-d)?\./u.test(String(file))
  );

  if (testFiles.length > 0) {
    throw new Error(`The tarball ships test files: ${testFiles.join(", ")}`);
  }
}

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function typecheck(consumerDir: string): void {
  for (const { packageName, resolutionModes: modes } of typeScriptVersions) {
    const compilerPath = path.join(
      path.dirname(repoRequire.resolve(`${packageName}/package.json`)),
      "bin/tsc"
    );
    const { version } = repoRequire(`${packageName}/package.json`) as {
      version: string;
    };

    for (const { files, flags, name } of modes) {
      const deprecationFlags =
        name === "node10" && version.startsWith("6.")
          ? ["--ignoreDeprecations", "6.0"]
          : [];

      console.log(`[test-consumer] TypeScript ${version} · ${name}`);
      run(
        process.execPath,
        [
          compilerPath,
          ...sharedCompilerFlags,
          ...flags,
          ...deprecationFlags,
          ...files,
        ],
        consumerDir
      );
    }
  }
}

const consumerDir = mkdtempSync(path.join(tmpdir(), "safe-fns-consumer-"));

try {
  packInto(consumerDir);
  copyFixtures(consumerDir);
  typecheck(consumerDir);
  run(process.execPath, ["smoke.ts"], consumerDir);
  // No `catch`: a failure should propagate and exit non-zero, after cleanup.
} finally {
  rmSync(consumerDir, { force: true, recursive: true });
}
