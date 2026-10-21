import { Duration } from "luxon";
import { describe, expect, test } from "vitest";

import {
  describeError,
  describeStillRunning,
  printPrefixed,
} from "./logging.ts";

describe("describeError", () => {
  test.each([
    { description: "a thrown string", error: "boom", expected: "boom" },
    {
      description: "an error",
      error: new Error("outer"),
      expected: "outer",
    },
    {
      description: "an error with causes",
      error: new Error("outer", {
        cause: new Error("middle", { cause: "inner" }),
      }),
      expected: "outer\n  caused by: middle\n  caused by: inner",
    },
  ])("describes $description", ({ error, expected }) => {
    // Given/When/Then - one line per cause, outermost first
    expect(describeError(error)).toBe(expected);
  });
});

describe("describeStillRunning", () => {
  test.each([
    {
      description: "with nothing on stderr",
      expected: "dotnet: still running after 1m 30s",
      stderr: "",
    },
    {
      description: "quoting the last non-blank stderr line",
      expected:
        "dotnet: still running after 1m 30s; last stderr: at Codec.Decode()",
      stderr: "Unhandled exception. Boom\n   at Codec.Decode()\n\n",
    },
    {
      description: "cutting a long stderr line short",
      expected: `dotnet: still running after 1m 30s; last stderr: ${"x".repeat(200)}…`,
      stderr: "x".repeat(250),
    },
  ])("describes a run $description", ({ expected, stderr }) => {
    // Given - an adapter that has run for a minute and a half
    const elapsed = Duration.fromObject({ seconds: 90 });

    // When - describing it
    const line = describeStillRunning({ elapsed, stderr, subject: "dotnet" });

    // Then - the line names it, its time, and its last stderr line
    expect(line).toBe(expected);
  });
});

describe("printPrefixed", () => {
  test("prefixes every line of a message", () => {
    // Given - a printer that records its lines
    const lines: string[] = [];

    // When - printing a two-line message
    printPrefixed({
      message: "first\nsecond",
      prefix: "[test]",
      print: (line) => lines.push(line),
    });

    // Then - each line carries the prefix
    expect(lines).toStrictEqual(["[test] first", "[test] second"]);
  });
});
