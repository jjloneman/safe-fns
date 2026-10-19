import { describe, expect, test } from "vitest";

import type { DatabaseCommand, DatabaseService } from "./compose.ts";

import {
  DATABASE_COMMANDS,
  findContainersToRemove,
  findNetworksInUse,
  findUnexpectedRemovalErrors,
  profileArgs,
  toDatabaseArgs,
} from "./compose.ts";

const COMMANDS: readonly DatabaseCommand[] = ["down", "rm", "up"];

const DATABASES: readonly DatabaseService[] = [
  { name: "mysql", profiles: ["db"] },
  { name: "postgres", profiles: ["db", "sql"] },
];

describe("findNetworksInUse", () => {
  test.each([
    { description: "an empty stderr", expected: [], stderr: "" },
    {
      description: "a clean teardown",
      expected: [],
      stderr: [
        " Container p-mysql-1 Removed ",
        " Network p_mysql Removing ",
        " Network p_mysql Removed ",
      ].join("\n"),
    },
    {
      description: "two networks kept in use",
      expected: ["p_mysql", "p_postgres"],
      stderr: [
        " Container p-mysql-1 Removed ",
        " Network p_mysql Removing ",
        " Network p_mysql Resource is still in use ",
        " Network p_postgres Resource is still in use ",
      ].join("\n"),
    },
    {
      description: "padded or prefixed notices",
      expected: ["p_mysql", "p_postgres"],
      stderr: [
        "  Network   p_mysql   Resource is still in use",
        "! Network p_postgres Resource is still in use",
      ].join("\n"),
    },
  ])("reads $description", ({ expected, stderr }) => {
    // Given/When/Then - only Compose's own kept-network lines count
    expect(findNetworksInUse(stderr)).toStrictEqual(expected);
  });
});

describe("findContainersToRemove", () => {
  test.each([
    { description: "an empty listing", expected: [], psOutput: "" },
    {
      description: "running and exited containers",
      expected: ["7d52", "8a3c"],
      psOutput: "7d52 running\n8a3c exited\n",
    },
    {
      description: "a container already being removed",
      expected: ["8a3c"],
      psOutput: "7d52 removing\n8a3c created\n",
    },
  ])("reads $description", ({ expected, psOutput }) => {
    // Given/When/Then - every id except those already on their way out
    expect(findContainersToRemove(psOutput)).toStrictEqual(expected);
  });
});

describe("findUnexpectedRemovalErrors", () => {
  test.each([
    { description: "an empty stderr", expected: [], stderr: "" },
    {
      description: "containers already being removed or gone",
      expected: [],
      stderr: [
        "Error response from daemon: removal of container 7d52 is already in progress",
        "Error response from daemon: No such container: 8a3c",
        "",
      ].join("\n"),
    },
    {
      description: "a real failure among benign ones",
      expected: ["Error response from daemon: permission denied"],
      stderr: [
        "Error response from daemon: removal of container 7d52 is already in progress",
        "Error response from daemon: permission denied",
      ].join("\n"),
    },
  ])("reads $description", ({ expected, stderr }) => {
    // Given/When/Then - only errors that leave a container behind remain
    expect(findUnexpectedRemovalErrors(stderr)).toStrictEqual(expected);
  });
});

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

describe("toDatabaseArgs", () => {
  test("is tested with every command", () => {
    // Given/When/Then - the table below covers each key, so none goes untested
    expect([...COMMANDS].sort()).toStrictEqual(
      Object.keys(DATABASE_COMMANDS).sort()
    );
  });

  test.each(
    COMMANDS.map((command) => ({
      command,
      description: command,
      flags: DATABASE_COMMANDS[command],
    }))
  )("names each database after `$description`", ({ command, flags }) => {
    // Given - two databases sharing a profile

    // When - building the command
    const args = toDatabaseArgs({ command, databases: DATABASES });

    // Then - each profile once, the subcommand, then the names
    expect(args).toStrictEqual([
      "--profile",
      "db",
      "--profile",
      "sql",
      ...flags,
      "mysql",
      "postgres",
    ]);
  });

  test("refuses to name no database", () => {
    // Given - no databases, which would make `down` act on the whole project

    // When - building the teardown
    const build = (): string[] =>
      toDatabaseArgs({ command: "down", databases: [] });

    // Then - it throws rather than returning a project-wide command
    expect(build).toThrow("no database named for docker compose down");
  });
});
