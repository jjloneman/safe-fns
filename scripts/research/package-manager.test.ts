import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** Read the `packageManager` field of a `package.json`. */
function readPackageManager(directory: string): unknown {
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(directory, "package.json"), "utf8")
  );

  return typeof manifest === "object" &&
    manifest !== null &&
    "packageManager" in manifest
    ? manifest.packageManager
    : undefined;
}

describe("research/package.json", () => {
  test("pins the same pnpm as the root, which the Node image installs", () => {
    // Given
    const repoRoot = path.resolve(import.meta.dirname, "../..");

    // When
    const researchPnpm = readPackageManager(path.join(repoRoot, "research"));

    // Then
    expect(researchPnpm).toBe(readPackageManager(repoRoot));
  });
});
