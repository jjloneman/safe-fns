import { describe, expect, test } from "vitest";

import type { DatabaseService } from "./compose-args.ts";

import {
  profileArgs,
  toDatabaseFallbackRemovalArgs,
  toDatabaseRemovalArgs,
  toDatabaseStartArgs,
} from "./compose-args.ts";

const DATABASES: readonly DatabaseService[] = [
  { name: "mysql", profiles: ["db"] },
  { name: "postgres", profiles: ["db", "sql"] },
];

describe("profileArgs", () => {
  test.each([
    { description: "no profiles", expected: [], profiles: [] },
    {
      description: "two profiles",
      expected: ["--profile", "db", "--profile", "sql"],
      profiles: ["db", "sql"],
    },
  ])("flags $description", ({ expected, profiles }) => {
    // Given/When/Then - one `--profile` flag per name, in order
    expect(profileArgs(profiles)).toStrictEqual(expected);
  });
});

describe("toDatabaseRemovalArgs", () => {
  test("removes the databases with their volumes and networks", () => {
    // Given - two databases sharing a profile

    // When - building the teardown
    const args = toDatabaseRemovalArgs(DATABASES);

    // Then - a service-scoped `down`, so networks go too, each profile once
    expect(args).toStrictEqual([
      "--profile",
      "db",
      "--profile",
      "sql",
      "down",
      "--volumes",
      "mysql",
      "postgres",
    ]);
  });

  test("names no service when there are no databases", () => {
    // Given/When/Then - an empty set builds a bare `down`, which callers skip
    expect(toDatabaseRemovalArgs([])).toStrictEqual(["down", "--volumes"]);
  });
});

describe("toDatabaseFallbackRemovalArgs", () => {
  test("stops and removes the databases by name", () => {
    // Given - two databases sharing a profile

    // When - building the fallback teardown
    const args = toDatabaseFallbackRemovalArgs(DATABASES);

    // Then - the `rm` form older Compose accepts
    expect(args).toStrictEqual([
      "--profile",
      "db",
      "--profile",
      "sql",
      "rm",
      "--force",
      "--stop",
      "--volumes",
      "mysql",
      "postgres",
    ]);
  });
});

describe("toDatabaseStartArgs", () => {
  test("starts the databases and waits on their healthchecks", () => {
    // Given - two databases sharing a profile

    // When - building the start command
    const args = toDatabaseStartArgs(DATABASES);

    // Then - a detached `up` that waits, each profile once
    expect(args).toStrictEqual([
      "--profile",
      "db",
      "--profile",
      "sql",
      "up",
      "--detach",
      "--wait",
      "mysql",
      "postgres",
    ]);
  });
});
