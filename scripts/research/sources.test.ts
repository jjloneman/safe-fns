import { describe, expect, test } from "vitest";

import type { AdapterColumn, CaseFile } from "./results.ts";

import { checkSourceFunctions, toSourceColumns } from "./sources.ts";

const CASE_FILE: CaseFile = {
  cases: [{ args: ["1e3"] }, { args: ["x"] }],
  function: "safeParseNumber",
};

const cachedColumn = (cases: unknown[]): Record<string, unknown> => ({
  call: "VALUE(value)",
  cases,
  function: "safeParseNumber",
  locale: "en-US",
  name: "Excel",
  tier: 3,
  version: "Microsoft 365",
});

describe("checkSourceFunctions", () => {
  test("accepts columns whose functions have case files", () => {
    // Given - a source answering a known function
    const sourceFiles = [
      {
        json: { columns: [cachedColumn([])] },
        source: "research/sources/x.md",
      },
    ];

    // When - checking it
    const check = (): void => {
      checkSourceFunctions({
        functionNames: ["safeParseNumber"],
        sourceFiles,
      });
    };

    // Then - nothing is thrown
    expect(check).not.toThrow();
  });

  test("rejects a column naming a function no case file has", () => {
    // Given - a source answering a misspelled function
    const sourceFiles = [
      {
        json: {
          columns: [{ ...cachedColumn([]), function: "safeParseNumbers" }],
        },
        source: "research/sources/x.md",
      },
    ];

    // When - checking it
    const check = (): void => {
      checkSourceFunctions({
        functionNames: ["safeParseNumber"],
        sourceFiles,
      });
    };

    // Then - it throws, naming the function
    expect(check).toThrow(/safeParseNumbers/u);
  });
});

describe("toSourceColumns", () => {
  test("answers the cases the source settles and leaves the rest n/a", () => {
    // Given - a source that settles one of two cases, and one for another function
    const json = {
      columns: [
        cachedColumn([
          { args: ["1e3"], outcome: { kind: "value", value: 1000 } },
        ]),
        { ...cachedColumn([]), function: "safeParseBoolean" },
      ],
    };

    // When - building the case file's columns
    const columns = toSourceColumns({
      caseFile: CASE_FILE,
      sourceFiles: [{ json, source: "research/sources/excel.md" }],
    });

    // Then - one column, in case order, citing its source
    expect(columns).toStrictEqual([
      {
        call: "VALUE(value)",
        function: "safeParseNumber",
        locale: "en-US",
        name: "Excel",
        outcomes: [{ kind: "value", value: 1000 }, { kind: "n/a" }],
        source: "research/sources/excel.md",
        tier: 3,
        version: "Microsoft 365",
      },
    ]);
  });

  test.each([
    { description: "a file without a columns array", json: { columns: {} } },
    { description: "a non-object file", json: null },
    { description: "a column without cases", json: { columns: [{}] } },
    { description: "a non-object column", json: { columns: [null] } },
    {
      description: "a case without args",
      json: { columns: [cachedColumn([{ outcome: { kind: "n/a" } }])] },
    },
    {
      description: "a case the case file no longer has",
      json: {
        columns: [cachedColumn([{ args: ["gone"], outcome: { kind: "n/a" } }])],
      },
    },
    {
      description: "a case settled twice",
      json: {
        columns: [
          cachedColumn([
            { args: ["x"], outcome: { kind: "n/a" } },
            { args: ["x"], outcome: { kind: "n/a" } },
          ]),
        ],
      },
    },
    {
      description: "a malformed outcome",
      json: { columns: [cachedColumn([{ args: ["x"], outcome: {} }])] },
    },
  ])("rejects $description", ({ json }) => {
    // When - building columns from a malformed source
    const build = (): AdapterColumn[] =>
      toSourceColumns({
        caseFile: CASE_FILE,
        sourceFiles: [{ json, source: "research/sources/excel.md" }],
      });

    // Then - it throws, naming the source
    expect(build).toThrow(Error);
  });
});
