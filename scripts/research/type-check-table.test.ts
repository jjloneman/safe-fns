import { describe, expect, test } from "vitest";

import type { TypeCheckFunction } from "./type-check-cases.ts";
import type { CompilerRun } from "./type-check-table.ts";

import {
  findOrphanTables,
  parseTscErrors,
  renderTypeChecks,
  toCheckFile,
  toTableFile,
} from "./type-check-table.ts";

const CHECKED_FUNCTION: TypeCheckFunction = {
  cases: [{ assertion: "Equal<H<A | B>, `${A}`>", description: "a case" }],
  name: "PartialDeep",
  tools: [
    {
      exportName: "PartialDeep",
      module: "./partial-deep",
      name: "safe-fns",
      sourceFiles: ["partial-deep.ts", "leaf.ts"],
    },
    { exportName: "PartialDeep", module: "type-fest", name: "type-fest" },
  ],
};

/** The table row of the one case in `CHECKED_FUNCTION`. */
function caseRow(runs: readonly CompilerRun[]): string | undefined {
  return renderTypeChecks({
    checkedFunction: CHECKED_FUNCTION,
    runs,
    toolVersions: new Map([["type-fest", "5.10.0"]]),
  })
    .split("\n")
    .find((line) => line.startsWith("| a case"));
}

describe("toCheckFile", () => {
  test("names a file by helper, tool, and case", () => {
    // Given/When - the second tool's fourth case
    const file = toCheckFile({
      caseIndex: 3,
      functionName: "PartialDeep",
      toolIndex: 1,
    });

    // Then - a path under the helper's directory
    expect(file).toBe("PartialDeep/1-3.ts");
  });
});

describe("toTableFile", () => {
  test.each([
    {
      description: "a plain name",
      expected: "partial-deep.md",
      name: "PartialDeep",
    },
    {
      description: "a run of capitals",
      expected: "json-value-deep.md",
      name: "JSONValueDeep",
    },
    {
      description: "a digit before a capital",
      expected: "base64-deep.md",
      name: "Base64Deep",
    },
  ])("names $description in kebab case", ({ expected, name }) => {
    // Given/When - the helper's table file
    const file = toTableFile(name);

    // Then - the kebab-case name
    expect(file).toBe(expected);
  });
});

describe("findOrphanTables", () => {
  test("finds a type-check table no helper writes, and nothing else", () => {
    // Given - a current table, a stale one, another audit, and an empty file
    const committed = [
      { file: "partial-deep.md", text: "# PartialDeep type checks\n" },
      { file: "old-deep.md", text: "# OldDeep type checks\n\nrows" },
      { file: "to-basic-ascii.md", text: "# toBasicAscii fold audit\n" },
      { file: "empty.md", text: "" },
    ];

    // When - comparing them with the current helpers' tables
    const orphans = findOrphanTables({
      committed,
      expectedFiles: ["partial-deep.md"],
    });

    // Then - only the stale type-check table
    expect(orphans).toStrictEqual(["old-deep.md"]);
  });
});

describe("parseTscErrors", () => {
  test("reads errors with and without a file, skipping other lines", () => {
    // Given - tsc output with a file error, its continuation, and a config error
    const output = [
      "PartialDeep/0-1.ts(3,20): error TS2344: Type 'false' does not satisfy the constraint 'true'.",
      "  The types of 'a' are incompatible.",
      "error TS5108: Option 'moduleResolution=node10' has been removed.",
      "",
    ].join("\n");

    // When - parsing it
    const errors = parseTscErrors(output);

    // Then - both errors, in order
    expect(errors).toStrictEqual([
      { code: "TS2344", file: "PartialDeep/0-1.ts" },
      { code: "TS5108", file: "" },
    ]);
  });
});

describe("renderTypeChecks", () => {
  test("writes the header, an escaped assertion, and the versions", () => {
    // Given - one clean run
    const runs = [{ errors: [], version: "6.0.3" }];

    // When - rendering the table
    const markdown = renderTypeChecks({
      checkedFunction: CHECKED_FUNCTION,
      runs,
      toolVersions: new Map([["type-fest", "5.10.0"]]),
    });

    // Then - every column passes, and the assertion keeps its backtick and pipe
    expect(markdown).toContain(
      "| Case | safe-fns<br>`PartialDeep` | type-fest<br>`PartialDeep` |"
    );
    expect(markdown).toContain(
      "| a case<br>`` Equal<H<A \\| B>, `${A}`> `` | ✅ | ✅ |"
    );
    expect(markdown).toContain("- TypeScript 6.0.3\n- type-fest 5.10.0\n");
  });

  test("writes an assertion without a backtick in a single-backtick span", () => {
    // Given - a case whose assertion holds no backtick
    const checkedFunction = {
      ...CHECKED_FUNCTION,
      cases: [{ assertion: "Equal<H<A>, A>", description: "plain" }],
    };

    // When - rendering the table
    const markdown = renderTypeChecks({
      checkedFunction,
      runs: [{ errors: [], version: "6.0.3" }],
      toolVersions: new Map(),
    });

    // Then - a plain code span, and no library versions listed
    expect(markdown).toContain("| plain<br>`Equal<H<A>, A>` |");
    expect(markdown).not.toContain("- type-fest");
  });

  test.each([
    {
      description: "an error in the check file fails only that tool",
      errors: [{ code: "TS2344", file: "PartialDeep/1-0.ts" }],
      expected: "| ✅ | ❌ `TS2344` |",
    },
    {
      description: "an error in a tool's package fails that tool",
      errors: [{ code: "TS1005", file: "../../type-fest/index.d.ts" }],
      expected: "| ✅ | ❌ `TS1005` |",
    },
    {
      description: "an error in a planned source file fails that column",
      errors: [{ code: "TS2304", file: "leaf.ts" }],
      expected: "| ❌ `TS2304` | ✅ |",
    },
    {
      description: "an error in another planned file fails neither column",
      errors: [{ code: "TS2304", file: "enum-literals-deep.ts" }],
      expected: "| ✅ | ✅ |",
    },
    {
      description: "an error with no file fails every tool",
      errors: [{ code: "TS5108", file: "" }],
      expected: "| ❌ `TS5108` | ❌ `TS5108` |",
    },
    {
      description: "a repeated code is listed once",
      errors: [
        { code: "TS2344", file: "PartialDeep/1-0.ts" },
        { code: "TS2344", file: "PartialDeep/1-0.ts" },
      ],
      expected: "| ✅ | ❌ `TS2344` |",
    },
  ])("$description", ({ errors, expected }) => {
    // Given - the same errors on both compilers
    const runs = [
      { errors, version: "4.9.5" },
      { errors, version: "6.0.3" },
    ];

    // When - rendering the case's row
    const row = caseRow(runs);

    // Then - the cells name the errors without versions
    expect(row?.endsWith(expected)).toBe(true);
  });

  test("counts an error in a scoped package against that package's tool", () => {
    // Given - a library published under a scope, failing in its own file
    const checkedFunction = {
      ...CHECKED_FUNCTION,
      tools: [
        ...CHECKED_FUNCTION.tools,
        { exportName: "Partial", module: "@scope/types", name: "@scope/types" },
      ],
    };

    const errors = [{ code: "TS1005", file: "../../@scope/types/index.d.ts" }];

    // When - rendering the table
    const markdown = renderTypeChecks({
      checkedFunction,
      runs: [{ errors, version: "6.0.3" }],
      toolVersions: new Map(),
    });

    // Then - only the scoped package's column fails
    expect(markdown).toContain("| ✅ | ✅ | ❌ `TS1005` |");
  });

  test("names the versions when not every compiler failed alike", () => {
    // Given - one error on 4.9, two on 5.0, the same two on 5.4, none on 6.0
    const file = "PartialDeep/1-0.ts";
    const runs = [
      { errors: [{ code: "TS2344", file }], version: "4.9.5" },
      {
        errors: [
          { code: "TS2344", file },
          { code: "TS2559", file },
        ],
        version: "5.0.4",
      },
      {
        errors: [
          { code: "TS2344", file },
          { code: "TS2559", file },
        ],
        version: "5.4.5",
      },
      {
        errors: [{ code: "TS2559", file }],
        version: "5.9.3",
      },
      { errors: [], version: "6.0.3" },
    ];

    // When - rendering the case's row
    const row = caseRow(runs);

    // Then - each group of codes with its versions
    expect(
      row?.endsWith(
        "| ✅ | ❌ `TS2344` (4.9.5); `TS2344`, `TS2559` (5.0.4, 5.4.5); `TS2559` (5.9.3) |"
      )
    ).toBe(true);
  });
});
