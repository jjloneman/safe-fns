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

import { TYPESCRIPT_VERSIONS } from "./lib/typescript-versions.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURE_DIR = path.join(REPO_ROOT, "test/consumer");

const SHARED_COMPILER_FLAGS = [
  "--noEmit",
  "--strict",
  "--target",
  "es2022",
  "--lib",
  "es2022",
];

const REPO_REQUIRE = createRequire(import.meta.url);

function copyFixtures(consumerDir: string): void {
  const typesFixture = path.join(FIXTURE_DIR, "types.ts");

  for (const file of ["types.ts", "types.cts", "types.mts"]) {
    copyFileSync(typesFixture, path.join(consumerDir, file));
  }

  copyFileSync(
    path.join(FIXTURE_DIR, "smoke.ts"),
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
  run("pnpm", ["pack", "--pack-destination", packDir], REPO_ROOT);

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
  for (const { packageName, resolutionModes: modes } of TYPESCRIPT_VERSIONS) {
    const compilerPath = path.join(
      path.dirname(REPO_REQUIRE.resolve(`${packageName}/package.json`)),
      "bin/tsc"
    );
    const { version } = REPO_REQUIRE(`${packageName}/package.json`) as {
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
          ...SHARED_COMPILER_FLAGS,
          ...flags,
          ...deprecationFlags,
          ...files,
        ],
        consumerDir
      );
    }
  }
}

const CONSUMER_DIR = mkdtempSync(path.join(tmpdir(), "safe-fns-consumer-"));

try {
  packInto(CONSUMER_DIR);
  copyFixtures(CONSUMER_DIR);
  typecheck(CONSUMER_DIR);
  run(process.execPath, ["smoke.ts"], CONSUMER_DIR);
  // No `catch`: a failure should propagate and exit non-zero, after cleanup.
} finally {
  rmSync(CONSUMER_DIR, { force: true, recursive: true });
}
