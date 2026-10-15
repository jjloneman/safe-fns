import { describe, expect, test } from "vitest";

import type {
  AdapterColumn,
  CaseFile,
  FunctionResult,
  ResultColumn,
} from "./results.ts";

import {
  buildResults,
  findCodecMismatches,
  mergeWithPrevious,
  parseAdapterOutput,
  parseCaseFile,
  parseFunctionResult,
  stringifyStable,
} from "./results.ts";

function column(overrides: Partial<AdapterColumn>): AdapterColumn {
  return {
    call: "f(value)",
    function: "f",
    locale: "C.UTF-8",
    name: "tool",
    outcomes: [{ kind: "value", value: true }],
    tier: 1,
    version: "1.0.0",
    ...overrides,
  };
}

describe("parseCaseFile", () => {
  test("keeps args and any expected answer", () => {
    // Given - a case file with a plain case and one with a planned answer
    const json = {
      cases: [
        { args: ["a"] },
        { args: [{ $undefined: true }], expected: false },
      ],
      function: "f",
    };

    // When - narrowing it
    const caseFile = parseCaseFile(json);

    // Then - it comes back unchanged
    expect(caseFile).toStrictEqual(json);
  });

  test("decodes $utf16 tags in an expected answer, at any depth", () => {
    // Given - planned answers spelling a lone surrogate by its code unit
    const json = {
      cases: [
        { args: ["a"], expected: { $utf16: [0xd8_00] } },
        { args: ["b"], expected: [{ text: { $utf16: [0x68, 0x69] } }] },
        { args: ["c"], expected: { a: { $utf16: [0x61] }, b: 1 } },
        {
          args: ["d"],
          expected: { $object: { $utf16: { $utf16: [0x78] } } },
        },
      ],
      function: "f",
    };

    // When - narrowing it
    const caseFile = parseCaseFile(json);

    // Then - each tag becomes its string, and an escaped `$utf16` key stays
    expect(caseFile.cases.map(({ expected }) => expected)).toStrictEqual([
      "\uD800",
      [{ text: "hi" }],
      { a: "a", b: 1 },
      { $object: { $utf16: "x" } },
    ]);
  });

  test.each([
    { description: "a non-array", payload: "\\ud800" },
    { description: "a fraction", payload: [1.5] },
    { description: "a negative number", payload: [-1] },
    { description: "a value past 0xFFFF", payload: [0x1_00_00] },
    { description: "a string code unit", payload: ["d800"] },
  ])("rejects a utf16 tag holding $description", ({ payload }) => {
    // Given - a planned answer whose tag isn't an array of code units
    const json = {
      cases: [{ args: [], expected: { $utf16: payload } }],
      function: "f",
    };

    // When - narrowing it
    const parse = (): CaseFile => parseCaseFile(json);

    // Then - it throws, naming the case
    expect(parse).toThrow("case 0 has a `$utf16` tag");
  });

  test.each([
    { description: "a non-object", json: [] },
    { description: "a missing function", json: { cases: [] } },
    { description: "a non-object case", json: { cases: [1], function: "f" } },
    { description: "missing args", json: { cases: [{}], function: "f" } },
    {
      description: "non-JSON args",
      json: { cases: [{ args: [Number.NaN] }], function: "f" },
    },
    {
      description: "a non-JSON expected answer",
      json: { cases: [{ args: [], expected: () => 1 }], function: "f" },
    },
  ])("rejects $description", ({ json }) => {
    // When - narrowing a malformed case file
    const parse = (): CaseFile => parseCaseFile(json);

    // Then - it throws, naming the bad field
    expect(parse).toThrow(Error);
  });
});

describe("parseAdapterOutput", () => {
  test("keeps every kind of outcome", () => {
    // Given - adapter output with a value, an error, and an n/a outcome
    const json = {
      columns: [
        column({
          outcomes: [
            { kind: "value", value: [1, { a: null }] },
            { error: "TypeError", kind: "error" },
            { kind: "n/a" },
          ],
        }),
      ],
    };

    // When - narrowing it
    const columns = parseAdapterOutput(json);

    // Then - every outcome survives
    expect(columns).toStrictEqual(json.columns);
  });

  test("keeps a docs-only column's source", () => {
    // Given - a column transcribed from a cached source
    const json = { columns: [column({ source: "research/sources/x.md" })] };

    // When - narrowing it
    const columns = parseAdapterOutput(json);

    // Then - the source survives
    expect(columns[0]?.source).toBe("research/sources/x.md");
  });

  test.each([
    { description: "no columns array", json: { columns: {} } },
    { description: "a non-object", json: null },
    { description: "a missing function", json: { columns: [{ tier: 1 }] } },
    {
      description: "a missing string field",
      json: { columns: [{ function: "f", tier: 1 }] },
    },
    {
      description: "a bad tier",
      json: { columns: [column({ tier: 9 as 1 })] },
    },
    {
      description: "non-array outcomes",
      json: { columns: [{ ...column({}), outcomes: {} }] },
    },
    {
      description: "an unknown outcome kind",
      json: { columns: [{ ...column({}), outcomes: [{ kind: "maybe" }] }] },
    },
    {
      description: "an error outcome without a class name",
      json: { columns: [{ ...column({}), outcomes: [{ kind: "error" }] }] },
    },
    {
      description: "a non-string source",
      json: { columns: [{ ...column({}), source: 1 }] },
    },
    {
      description: "a value outcome without JSON",
      json: { columns: [{ ...column({}), outcomes: [{ kind: "value" }] }] },
    },
  ])("rejects $description", ({ json }) => {
    // When - narrowing malformed adapter output
    const parse = (): AdapterColumn[] => parseAdapterOutput(json);

    // Then - it throws, naming the bad field
    expect(parse).toThrow(Error);
  });
});

describe("buildResults", () => {
  test("merges columns per function, adds the plan, and sorts by tier, name, and call", () => {
    // Given - two case files, and columns out of order with one planned answer
    const caseFiles: CaseFile[] = [
      {
        cases: [{ args: ["a"], expected: true }, { args: ["b"] }],
        function: "f",
      },
      { cases: [{ args: ["c"] }], function: "g" },
    ];

    const twoOutcomes = column({
      outcomes: [{ kind: "value", value: true }, { kind: "n/a" }],
    });

    // When - building the results
    const results = buildResults({
      caseFiles,
      serviceColumns: [
        {
          columns: [
            { ...twoOutcomes, call: "z(value)", tier: 2 },
            { ...twoOutcomes, call: "y(value)", tier: 2 },
            { ...twoOutcomes, call: "b(value)", name: "Beta" },
            { ...twoOutcomes, call: "a(value)", name: "beta" },
            { ...twoOutcomes, name: "alpha" },
            column({ function: "g" }),
          ],
          image: "img@sha256:1",
          inputs: "sha256:in",
          service: "node",
        },
      ],
    });

    // Then - one result per case file, the plan first, then sorted columns
    expect(results.map((result) => result.function)).toStrictEqual(["f", "g"]);
    expect(
      results[0]?.columns.map(({ call, name }) => `${name} ${call}`)
    ).toStrictEqual([
      "safe-fns (planned) f",
      "alpha f(value)",
      "beta a(value)",
      "Beta b(value)",
      "tool y(value)",
      "tool z(value)",
    ]);
    expect(results[0]?.columns[0]?.outcomes).toStrictEqual([
      { kind: "value", value: true },
      { kind: "n/a" },
    ]);
    expect(results[1]?.columns).toHaveLength(1);
    expect(results[1]?.columns[0]).toMatchObject({
      image: "img@sha256:1",
      inputs: "sha256:in",
      service: "node",
    });
  });

  test("carries a docs-only column's source into the result", () => {
    // Given - one case file and a column transcribed from a cached source
    const caseFiles: CaseFile[] = [{ cases: [{ args: ["a"] }], function: "f" }];

    // When - building the results
    const [result] = buildResults({
      caseFiles,
      serviceColumns: [
        {
          columns: [column({ source: "research/sources/x.md" })],
          image: "img@sha256:1",
          inputs: "sha256:in",
          service: "sources",
        },
      ],
    });

    // Then - the column keeps its source beside its image
    expect(result?.columns[0]).toMatchObject({
      image: "img@sha256:1",
      source: "research/sources/x.md",
    });
  });

  test("breaks ties that differ only in case, so the order is total", () => {
    // Given - columns whose names, then calls, differ only in case
    const caseFiles: CaseFile[] = [{ cases: [{ args: ["a"] }], function: "f" }];

    // When - building the results
    const [result] = buildResults({
      caseFiles,
      serviceColumns: [
        {
          columns: [
            column({ call: "f(value)", name: "Tool" }),
            column({ call: "F(value)", name: "tool" }),
            column({ call: "f(value)", name: "tool" }),
          ],
          image: "i",
          inputs: "sha256:in",
          service: "s",
        },
      ],
    });

    // Then - lowercase sorts first, by name and then by call
    expect(
      result?.columns.map(({ call, name }) => `${name} ${call}`)
    ).toStrictEqual(["tool f(value)", "tool F(value)", "Tool f(value)"]);
  });

  test("rejects a column whose outcomes don't match the cases", () => {
    // Given - a case file with two cases
    const caseFiles: CaseFile[] = [
      { cases: [{ args: [] }, { args: [] }], function: "f" },
    ];

    // When - building with a column of one outcome
    const build = (): FunctionResult[] =>
      buildResults({
        caseFiles,
        serviceColumns: [
          { columns: [column({})], image: "i", inputs: "x", service: "s" },
        ],
      });

    // Then - it throws, naming both counts
    expect(build).toThrow(/1 outcomes for 2 f cases/u);
  });
});

describe("findCodecMismatches", () => {
  const result = (outcomes: AdapterColumn["outcomes"]): FunctionResult => ({
    cases: [["x"], [{ $js: "a symbol" }], [{ a: 2, b: 1 }]],
    columns: [{ ...column({ outcomes }), image: "i", service: "s" }],
    function: "codec",
  });

  test("accepts round-trips, n/a, and any outcome for a named JavaScript value", () => {
    // Given - a round-trip, a named JavaScript value, and a reordered object
    const outcomes: AdapterColumn["outcomes"] = [
      { kind: "value", value: "x" },
      { kind: "value", value: { $repr: "Symbol()" } },
      { kind: "value", value: { a: 2, b: 1 } },
    ];

    // When - checking the codec
    const mismatches = findCodecMismatches(result(outcomes));

    // Then - nothing is reported
    expect(mismatches).toStrictEqual([]);
  });

  test("reports a changed value, a throw, and an extra outcome", () => {
    // Given - a changed value, a throw, and an outcome past the last case
    const outcomes: AdapterColumn["outcomes"] = [
      { kind: "value", value: "y" },
      { kind: "n/a" },
      { error: "TypeError", kind: "error" },
      { kind: "value", value: 1 },
    ];

    // When - checking the codec
    const mismatches = findCodecMismatches(result(outcomes));

    // Then - each one is reported
    expect(mismatches).toStrictEqual([
      'tool 1.0.0 case 1: expected "x", got {"kind":"value","value":"y"}',
      'tool 1.0.0 case 3: expected {"a":2,"b":1}, got {"error":"TypeError","kind":"error"}',
      'tool 1.0.0 case 4: expected null, got {"kind":"value","value":1}',
    ]);
  });
});

function resultColumn(overrides: Partial<ResultColumn>): ResultColumn {
  return {
    call: "f(value)",
    image: "i",
    locale: "C.UTF-8",
    name: "tool",
    outcomes: [{ kind: "value", value: true }],
    service: "node",
    tier: 1,
    version: "1.0.0",
    ...overrides,
  };
}

describe("mergeWithPrevious", () => {
  const next: FunctionResult = {
    cases: [["a"]],
    columns: [
      resultColumn({ name: "safe-fns (planned)", service: "-", tier: 0 }),
      resultColumn({ name: "Python", service: "python", tier: 2 }),
    ],
    function: "f",
  };

  test("keeps the committed columns of every service that didn't run", () => {
    // Given - a committed result with an old plan, a skipped service, and a rerun one
    const previous: FunctionResult = {
      ...next,
      columns: [
        resultColumn({ name: "old plan", service: "-", tier: 0 }),
        resultColumn({ name: "lodash" }),
        resultColumn({ name: "Python (old)", service: "python", tier: 2 }),
      ],
    };

    // When - merging a python-only run
    const merged = mergeWithPrevious({
      next,
      previous,
      servicesRun: new Set(["python"]),
    });

    // Then - the new plan and python columns, with lodash kept
    expect(merged.columns.map(({ name }) => name)).toStrictEqual([
      "safe-fns (planned)",
      "lodash",
      "Python",
    ]);
  });

  test("returns the new result when nothing was committed", () => {
    // When - merging with nothing committed
    const merged = mergeWithPrevious({
      next,
      previous: undefined,
      servicesRun: new Set(["python"]),
    });

    // Then - the new result is returned as it is
    expect(merged).toBe(next);
  });

  test("refuses when the cases changed", () => {
    // Given - committed results for different cases
    const previous: FunctionResult = { ...next, cases: [["b"]] };

    // When - merging
    const merge = (): FunctionResult =>
      mergeWithPrevious({ next, previous, servicesRun: new Set() });

    // Then - it throws, asking for a full run
    expect(merge).toThrow(/rerun every profile/u);
  });
});

describe("parseFunctionResult", () => {
  test.each([
    { description: "without inputs", inputs: {} },
    { description: "with inputs", inputs: { inputs: "sha256:in" } },
  ])("keeps a committed result $description", ({ inputs }) => {
    // Given - a committed result
    const json: FunctionResult = {
      cases: [["a", { $undefined: true }]],
      columns: [{ ...resultColumn({}), ...inputs }],
      function: "f",
    };

    // When - narrowing it
    const result = parseFunctionResult(json);

    // Then - it comes back unchanged
    expect(result).toStrictEqual(json);
  });

  test.each([
    { description: "a non-object", json: "x" },
    { description: "missing columns", json: { cases: [], function: "f" } },
    {
      description: "a case that isn't an array",
      json: { cases: ["a"], columns: [], function: "f" },
    },
    {
      description: "a column without a service",
      json: {
        cases: [],
        columns: [{ ...resultColumn({}), service: 1 }],
        function: "f",
      },
    },
    {
      description: "a column whose inputs aren't a string",
      json: {
        cases: [],
        columns: [{ ...resultColumn({}), inputs: 1 }],
        function: "f",
      },
    },
  ])("rejects $description", ({ json }) => {
    // When - narrowing a malformed result
    const parse = (): FunctionResult => parseFunctionResult(json);

    // Then - it throws, naming the bad field
    expect(parse).toThrow(Error);
  });
});

describe("stringifyStable", () => {
  test("sorts nested keys and ends with a newline", () => {
    // Given - a value with unsorted keys at two depths
    const value = { a: null, b: [{ c: 2, d: 1 }] };

    // When - serializing it
    const text = stringifyStable(value);

    // Then - keys are sorted, indented by two, and newline-terminated
    expect(text).toBe(
      '{\n  "a": null,\n  "b": [\n    {\n      "c": 2,\n      "d": 1\n    }\n  ]\n}\n'
    );
  });
});
