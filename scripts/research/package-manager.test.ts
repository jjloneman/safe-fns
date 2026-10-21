import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { isRecord } from "./codec.ts";
import { readJsonFile } from "./json.ts";

/** The repo root, which holds the root `package.json`. */
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** The research harness's own pnpm roots, each installed by an image. */
const RESEARCH_ROOTS = [
  { description: "research/", directory: "research" },
  {
    description: "research/adapters/assemblyscript/",
    directory: "research/adapters/assemblyscript",
  },
  {
    description: "research/docker/firebase/",
    directory: "research/docker/firebase",
  },
];

/** Matches a `pnpm-workspace.yaml`'s release-age floor, in minutes. */
const MINIMUM_RELEASE_AGE = /^minimumReleaseAge:\s*(?<minutes>\d+)\s*$/mu;

/** Read the `packageManager` field of a directory's `package.json`. */
function readPackageManager(directory: string): unknown {
  // No try/catch: a throw fails the test, and readJsonFile names the file.
  const manifest = readJsonFile(path.join(directory, "package.json"));

  return isRecord(manifest) ? manifest.packageManager : undefined;
}

/** Read a directory's `pnpm-workspace.yaml` release-age floor, if any. */
function readReleaseAgeFloor(directory: string): string | undefined {
  const workspace = readFileSync(
    path.join(directory, "pnpm-workspace.yaml"),
    "utf8"
  );

  return MINIMUM_RELEASE_AGE.exec(workspace)?.groups?.minutes;
}

describe("research pnpm roots", () => {
  test.each(RESEARCH_ROOTS)(
    "$description pins the same pnpm as the root, which its image installs",
    ({ directory }) => {
      // Given - the pnpm the root package pins
      const rootPnpm = readPackageManager(REPO_ROOT);

      // When - reading the research root's pin
      const researchPnpm = readPackageManager(path.join(REPO_ROOT, directory));

      // Then - the two match, so the image can't drift from the repo
      expect(researchPnpm).toBe(rootPnpm);
    }
  );

  test.each(RESEARCH_ROOTS)(
    "$description keeps the root's 7-day release-age floor",
    ({ directory }) => {
      // Given - the root's floor
      const rootFloor = readReleaseAgeFloor(REPO_ROOT);

      // When - reading the research root's floor
      const researchFloor = readReleaseAgeFloor(
        path.join(REPO_ROOT, directory)
      );

      // Then - both exist and match
      expect(rootFloor).toBe("10080");
      expect(researchFloor).toBe(rootFloor);
    }
  );
});
