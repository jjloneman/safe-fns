import { describe, expect, test } from "vitest";

import { describeError, printPrefixed } from "./logging.ts";

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
