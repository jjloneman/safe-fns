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

const column = (overrides: Partial<AdapterColumn>): AdapterColumn => ({
  call: "f(value)",
  function: "f",
  locale: "C.UTF-8",
  name: "tool",
  outcomes: [{ kind: "value", value: true }],
  tier: 1,
  version: "1.0.0",
  ...overrides,
});

describe("parseCaseFile", () => {
  test("keeps args and any expected answer", () => {
    // Given
    const json = {
      cases: [
        { args: ["a"] },
        { args: [{ $undefined: true }], expected: false },
      ],
      function: "f",
    };

    // When
    const caseFile = parseCaseFile(json);

    // Then
    expect(caseFile).toStrictEqual(json);
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
    // When
    const parse = (): CaseFile => parseCaseFile(json);

    // Then
    expect(parse).toThrow(Error);
  });
});

describe("parseAdapterOutput", () => {
  test("keeps every kind of outcome", () => {
    // Given
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

    // When
    const columns = parseAdapterOutput(json);

    // Then
    expect(columns).toStrictEqual(json.columns);
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
      description: "a value outcome without JSON",
      json: { columns: [{ ...column({}), outcomes: [{ kind: "value" }] }] },
    },
  ])("rejects $description", ({ json }) => {
    // When
    const parse = (): AdapterColumn[] => parseAdapterOutput(json);

    // Then
    expect(parse).toThrow(Error);
  });
});

describe("buildResults", () => {
  test("merges columns per function, adds the plan, and sorts by tier, name, and call", () => {
    // Given
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

    // When
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
          service: "node",
        },
      ],
    });

    // Then
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
      service: "node",
    });
  });

  test("rejects a column whose outcomes don't match the cases", () => {
    // Given
    const caseFiles: CaseFile[] = [
      { cases: [{ args: [] }, { args: [] }], function: "f" },
    ];

    // When
    const build = (): FunctionResult[] =>
      buildResults({
        caseFiles,
        serviceColumns: [{ columns: [column({})], image: "i", service: "s" }],
      });

    // Then
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
    // Given
    const outcomes: AdapterColumn["outcomes"] = [
      { kind: "value", value: "x" },
      { kind: "value", value: { $repr: "Symbol()" } },
      { kind: "value", value: { a: 2, b: 1 } },
    ];

    // When
    const mismatches = findCodecMismatches(result(outcomes));

    // Then
    expect(mismatches).toStrictEqual([]);
  });

  test("reports a changed value, a throw, and an extra outcome", () => {
    // Given
    const outcomes: AdapterColumn["outcomes"] = [
      { kind: "value", value: "y" },
      { kind: "n/a" },
      { error: "TypeError", kind: "error" },
      { kind: "value", value: 1 },
    ];

    // When
    const mismatches = findCodecMismatches(result(outcomes));

    // Then
    expect(mismatches).toStrictEqual([
      'tool 1.0.0 case 1: expected "x", got {"kind":"value","value":"y"}',
      'tool 1.0.0 case 3: expected {"a":2,"b":1}, got {"error":"TypeError","kind":"error"}',
      'tool 1.0.0 case 4: expected null, got {"kind":"value","value":1}',
    ]);
  });
});

const resultColumn = (overrides: Partial<ResultColumn>): ResultColumn => ({
  call: "f(value)",
  image: "i",
  locale: "C.UTF-8",
  name: "tool",
  outcomes: [{ kind: "value", value: true }],
  service: "node",
  tier: 1,
  version: "1.0.0",
  ...overrides,
});

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
    // Given
    const previous: FunctionResult = {
      ...next,
      columns: [
        resultColumn({ name: "old plan", service: "-", tier: 0 }),
        resultColumn({ name: "lodash" }),
        resultColumn({ name: "Python (old)", service: "python", tier: 2 }),
      ],
    };

    // When
    const merged = mergeWithPrevious({
      next,
      previous,
      servicesRun: new Set(["python"]),
    });

    // Then
    expect(merged.columns.map(({ name }) => name)).toStrictEqual([
      "safe-fns (planned)",
      "lodash",
      "Python",
    ]);
  });

  test("returns the new result when nothing was committed", () => {
    // When
    const merged = mergeWithPrevious({
      next,
      previous: undefined,
      servicesRun: new Set(["python"]),
    });

    // Then
    expect(merged).toBe(next);
  });

  test("refuses when the cases changed", () => {
    // Given
    const previous: FunctionResult = { ...next, cases: [["b"]] };

    // When
    const merge = (): FunctionResult =>
      mergeWithPrevious({ next, previous, servicesRun: new Set() });

    // Then
    expect(merge).toThrow(/rerun every profile/u);
  });
});

describe("parseFunctionResult", () => {
  test("keeps a committed result", () => {
    // Given
    const json: FunctionResult = {
      cases: [["a", { $undefined: true }]],
      columns: [resultColumn({})],
      function: "f",
    };

    // When
    const result = parseFunctionResult(json);

    // Then
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
  ])("rejects $description", ({ json }) => {
    // When
    const parse = (): FunctionResult => parseFunctionResult(json);

    // Then
    expect(parse).toThrow(Error);
  });
});

describe("stringifyStable", () => {
  test("sorts nested keys and ends with a newline", () => {
    // Given
    const value = { a: null, b: [{ c: 2, d: 1 }] };

    // When
    const text = stringifyStable(value);

    // Then
    expect(text).toBe(
      '{\n  "a": null,\n  "b": [\n    {\n      "c": 2,\n      "d": 1\n    }\n  ]\n}\n'
    );
  });
});
