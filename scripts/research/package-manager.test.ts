import path from "node:path";
import { describe, expect, test } from "vitest";

import { isRecord } from "./codec.ts";
import { readJsonFile } from "./json.ts";

/** The repo root, which holds the root `package.json`. */
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** Read the `packageManager` field of a directory's `package.json`. */
function readPackageManager(directory: string): unknown {
  // No try/catch: a throw fails the test, and readJsonFile names the file.
  const manifest = readJsonFile(path.join(directory, "package.json"));

  return isRecord(manifest) ? manifest.packageManager : undefined;
}

describe("research/package.json", () => {
  test("pins the same pnpm as the root, which the Node image installs", () => {
    // Given - the pnpm the root package pins
    const rootPnpm = readPackageManager(REPO_ROOT);

    // When - reading the research package's pin
    const researchPnpm = readPackageManager(path.join(REPO_ROOT, "research"));

    // Then - the two match, so the Node image can't drift from the repo
    expect(researchPnpm).toBe(rootPnpm);
  });
});
