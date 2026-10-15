import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

import type { EncodedValue } from "./codec.ts";

import {
  decodeValue,
  ENCODER_SOURCE,
  encodeValue,
  isRecord,
  renderValue,
} from "./codec.ts";

/** A row of a decoding table: an encoding and the value it decodes to. */
type DecodeRow = {
  /**
   * Names the row in the test title.
   *
   * @example "negative zero"
   */
  description: string;

  /**
   * The value to decode.
   *
   * @example `{ "$number": "-0" }`
   */
  encoded: EncodedValue;

  /**
   * The value it decodes to.
   *
   * @example -0
   */
  expected: unknown;
};

/** A row of a rendering table: an encoding and the literal it renders as. */
type RenderRow = {
  /**
   * The literal it renders as.
   *
   * @example "5n"
   */
  expected: string;
} & Omit<DecodeRow, "expected">;

/** Stands in for the Node adapter's `$js` factories. */
function resolveJs(name: string): unknown {
  return `built ${name}`;
}

describe("decodeValue", () => {
  test.each<DecodeRow>([
    { description: "a string", encoded: "x", expected: "x" },
    { description: "a finite number", encoded: 1.5, expected: 1.5 },
    { description: "a boolean", encoded: true, expected: true },
    { description: "null", encoded: null, expected: null },
    { description: "negative zero", encoded: { $number: "-0" }, expected: -0 },
    { description: "NaN", encoded: { $number: "NaN" }, expected: Number.NaN },
    {
      description: "infinity",
      encoded: { $number: "-Infinity" },
      expected: Number.NEGATIVE_INFINITY,
    },
    {
      description: "a bigint",
      encoded: { $bigint: "-9007199254740993" },
      expected: -9_007_199_254_740_993n,
    },
    {
      description: "undefined",
      encoded: { $undefined: true },
      expected: undefined,
    },
    {
      description: "an escaped object",
      encoded: { $object: { $tag: { $number: "NaN" } } },
      expected: { $tag: Number.NaN },
    },
    {
      description: "nested arrays and objects",
      encoded: [{ a: [{ $bigint: "1" }] }],
      expected: [{ a: [1n] }],
    },
    {
      description: "a named JavaScript value",
      encoded: { $js: "a symbol" },
      expected: "built a symbol",
    },
  ])("decodes $description", ({ encoded, expected }) => {
    // When - decoding the row's encoding
    const decoded = decodeValue({ encoded, resolveJs });

    // Then - it is the value the encoding describes
    expect(decoded).toStrictEqual(expected);
  });

  test.each<Omit<DecodeRow, "expected">>([
    {
      description: "a tag beside another key",
      encoded: { $bigint: "1", a: 1 },
    },
    { description: "a non-integer bigint", encoded: { $bigint: "1.5" } },
    { description: "an unknown special number", encoded: { $number: "1" } },
    { description: "an unknown tag", encoded: { $date: "2026" } },
    { description: "a bad payload", encoded: { $undefined: false } },
    { description: "an array as an object payload", encoded: { $object: [] } },
  ])("rejects $description", ({ encoded }) => {
    // When - decoding a malformed tag
    const decode = (): unknown => decodeValue({ encoded, resolveJs });

    // Then - it throws instead of guessing
    expect(decode).toThrow(Error);
  });
});

describe("encodeValue", () => {
  const { proxy: revokedProxy, revoke } = Proxy.revocable({}, {});
  revoke();

  test.each([
    { description: "a string", expected: "x", value: "x" },
    { description: "a boolean", expected: false, value: false },
    { description: "a finite number", expected: 2, value: 2 },
    { description: "negative zero", expected: { $number: "-0" }, value: -0 },
    { description: "NaN", expected: { $number: "NaN" }, value: Number.NaN },
    {
      description: "infinity",
      expected: { $number: "Infinity" },
      value: Number.POSITIVE_INFINITY,
    },
    { description: "a bigint", expected: { $bigint: "7" }, value: 7n },
    {
      description: "undefined",
      expected: { $undefined: true },
      value: undefined,
    },
    { description: "null", expected: null, value: null },
    {
      description: "an array",
      expected: [1, { $undefined: true }],
      value: [1, undefined],
    },
    {
      description: "a plain object",
      expected: { a: { $bigint: "1" } },
      value: { a: 1n },
    },
    {
      description: "a null-prototype object",
      expected: { a: 1 },
      value: Object.assign(Object.create(null) as object, { a: 1 }),
    },
    {
      description: "an object with a $ key",
      expected: { $object: { $tag: 1 } },
      value: { $tag: 1 },
    },
    {
      description: "a Map",
      expected: { $repr: "[object Map]" },
      value: new Map(),
    },
    {
      description: "a function",
      expected: { $repr: "function" },
      value: () => 1,
    },
    {
      description: "a symbol",
      expected: { $repr: "Symbol(s)" },
      value: Symbol("s"),
    },
    {
      description: "a revoked proxy",
      expected: { $repr: "an uninspectable value" },
      value: revokedProxy,
    },
  ])("encodes $description", ({ expected, value }) => {
    // When - encoding the row's value
    const encoded = encodeValue(value);

    // Then - it is the expected portable encoding
    expect(encoded).toStrictEqual(expected);
  });
});

describe("ENCODER_SOURCE", () => {
  test("encodes like encodeValue when evaluated in another realm", () => {
    // Given - a value that exercises every encoder branch
    const source = `[1n, -0, NaN, undefined, null, { $tag: [new Map()] }]`;

    // When - evaluating the embedded source in a fresh context, as JSON
    const encoded: unknown = runInNewContext(
      `${ENCODER_SOURCE}\nJSON.stringify(encodeValue(${source}));`
    );

    // Then - it prints the module's own encoding of the same value
    expect(encoded).toBe(
      JSON.stringify(
        encodeValue([
          1n,
          -0,
          Number.NaN,
          undefined,
          null,
          { $tag: [new Map()] },
        ])
      )
    );
  });
});

describe("isRecord", () => {
  test.each([
    { description: "an object", isExpectedRecord: true, value: { a: 1 } },
    { description: "an array", isExpectedRecord: false, value: [] },
    { description: "null", isExpectedRecord: false, value: null },
    { description: "a string", isExpectedRecord: false, value: "a" },
  ])("reads $description", ({ isExpectedRecord, value }) => {
    // When - checking the row's value
    const isRecordValue = isRecord(value);

    // Then - only a non-null, non-array object counts
    expect(isRecordValue).toBe(isExpectedRecord);
  });
});

describe("renderValue", () => {
  test.each<RenderRow>([
    { description: "a string", encoded: "a b", expected: '"a b"' },
    {
      description: "invisible characters",
      encoded: "\u00A0x\u200B\t",
      expected: String.raw`"\u{A0}x\u{200B}\u{9}"`,
    },
    {
      description: "a lone surrogate, but not a pair",
      encoded: "\uD800\u{1F600}",
      expected: '"\\u{D800}\u{1F600}"',
    },
    {
      description: "quotes and backslashes",
      encoded: String.raw`a"\u{A0}`,
      expected: String.raw`"a\"\\u{A0}"`,
    },
    { description: "a number", encoded: 1.5, expected: "1.5" },
    { description: "null", encoded: null, expected: "null" },
    { description: "an array", encoded: ["a", 1], expected: '["a", 1]' },
    { description: "an empty object", encoded: {}, expected: "{}" },
    {
      description: "an object",
      encoded: { a: true },
      expected: '{ "a": true }',
    },
    { description: "a bigint", encoded: { $bigint: "5" }, expected: "5n" },
    {
      description: "a special number",
      encoded: { $number: "-0" },
      expected: "-0",
    },
    {
      description: "undefined",
      encoded: { $undefined: true },
      expected: "undefined",
    },
    {
      description: "an escaped object",
      encoded: { $object: { $tag: 1 } },
      expected: '{ "$tag": 1 }',
    },
    {
      description: "a named value",
      encoded: { $js: "a Date" },
      expected: "‹a Date›",
    },
    {
      description: "a non-string payload",
      encoded: { $repr: 1 },
      expected: "‹1›",
    },
  ])("renders $description", ({ encoded, expected }) => {
    // When - rendering the row's encoding for a table cell
    const rendered = renderValue(encoded);

    // Then - it is the expected readable literal
    expect(rendered).toBe(expected);
  });
});
