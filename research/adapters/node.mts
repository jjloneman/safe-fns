import { runInNewContext } from "node:vm";

import type { EncodedValue } from "../../scripts/research/codec.ts";
import type {
  AdapterColumn,
  CaseFile,
  Outcome,
} from "../../scripts/research/results.ts";
import type { Probe, Tool } from "./node/tool.mts";

import { decodeValue, encodeValue } from "../../scripts/research/codec.ts";
import { readJsonFile } from "../../scripts/research/json.ts";
import { parseCaseFile } from "../../scripts/research/results.ts";
import { CROSS_REALM_INPUTS } from "../../test/cross-realm-inputs.ts";
import { HOSTILE_INPUTS } from "../../test/hostile-inputs.ts";
import { AJV_COERCE } from "./node/ajv.mts";
import { CANONICALIZE } from "./node/canonicalize.mts";
import { CSV } from "./node/csv.mts";
import { EFFECT } from "./node/effect.mts";
import { ENSURE_ERROR } from "./node/ensure-error.mts";
import { ENVALID } from "./node/envalid.mts";
import { ES_TOOLKIT } from "./node/es-toolkit.mts";
import { FAST_JSON_STABLE_STRINGIFY } from "./node/fast-json-stable-stringify.mts";
import { FAST_SAFE_STRINGIFY } from "./node/fast-safe-stringify.mts";
import { HTML } from "./node/html.mts";
import { INI } from "./node/ini.mts";
import { IS_PLAIN_OBJ } from "./node/is-plain-obj.mts";
import { JOI } from "./node/joi.mts";
import { JS_BUILT_INS } from "./node/js-built-ins.mts";
import { JSON_STRINGIFY_SAFE } from "./node/json-stringify-safe.mts";
import { JSON_FORMAT } from "./node/json.mts";
import { LODASH } from "./node/lodash.mts";
import { RADASH } from "./node/radash.mts";
import { RAMDA } from "./node/ramda.mts";
import { REMEDA } from "./node/remeda.mts";
import { SAFE_STABLE_STRINGIFY } from "./node/safe-stable-stringify.mts";
import { SINDRESORHUS_IS } from "./node/sindresorhus-is.mts";
import { TOML } from "./node/toml.mts";
import { errorName } from "./node/tool.mts";
import { UNDERSCORE } from "./node/underscore.mts";
import { VALIBOT } from "./node/valibot.mts";
import { VALIDATOR } from "./node/validator.mts";
import { YAML_1_1, YAML_1_2_CORE } from "./node/yaml.mts";
import { YN } from "./node/yn.mts";
import { YUP } from "./node/yup.mts";
import { ZOD } from "./node/zod.mts";

/*
 * The Node adapter: runs each case file through JS built-ins and the npm
 * libraries in `research/package.json`, and prints the columns as JSON.
 *
 * - Usage: `node node.mts <case-file>…`, inside the `node` Compose service.
 *
 * - Each tool's probes live in `node/<tool>.mts`; this file gathers them,
 *   builds the `$js` values, and runs the cases.
 *
 * - A `$js` case names a factory below, or an entry in the repo's own hostile
 *   and cross-realm test inputs.
 */

/** One case's encoded arguments, and the probe to run them through. */
type ProbeRun = {
  /**
   * The case's arguments, in the portable format.
   *
   * @example `[" yes "]`
   */
  args: readonly EncodedValue[];

  /**
   * The probe to run.
   *
   * @example `{ call: "yn(value)", run: ([value]) => yn(value) }`
   */
  probe: Probe;
};

/**
 * Builds each value a `$js` case names.
 *
 * - The repo's own hostile and cross-realm test inputs come first, keyed by
 *   their descriptions; the rest are values only this harness needs.
 */
const JS_FACTORIES: ReadonlyMap<string, () => unknown> = new Map<
  string,
  () => unknown
>([
  ...[...HOSTILE_INPUTS, ...CROSS_REALM_INPUTS].map(
    ({ description, value }) => [description, () => value] as const
  ),
  ["a 12 MB string", () => "x".repeat(12 * 1024 * 1024)],
  ["a boxed bigint", (): unknown => Object(1n)],
  ["a boxed blank string", () => new String("   ")],
  ["a boxed false", () => new Boolean(false)],
  ["a boxed JSON string", () => new String('{"a":1}')],
  ["a boxed number", () => new Number(1)],
  ["a boxed numeric string", () => new String(" 42 ")],
  ["a boxed string", () => new String("hi")],
  ["a boxed true", () => new Boolean(true)],
  ["a boxed URL string", () => new String("https://example.com/")],
  ["a Buffer of JSON text", () => Buffer.from('{"a":1}')],
  [
    "a class instance",
    () =>
      new (class Point {
        readonly x = 1;
      })(),
  ],
  [
    "a cross-realm Error with a message",
    (): unknown => runInNewContext('new Error("boom")'),
  ],
  [
    "a DataView of JSON text",
    () => new DataView(new TextEncoder().encode('{"a":1}').buffer),
  ],
  ["a Date", () => new Date(0)],
  ["a DOMException", () => new DOMException("aborted", "AbortError")],
  ["a function", () => () => undefined],
  ["a lone surrogate", () => "\uD800"],
  ["a Map with an entry", () => new Map([["a", 1]])],
  [
    "an ArrayBuffer of JSON text",
    () => new TextEncoder().encode('{"a":1}').buffer,
  ],
  ["an array with a cycle", () => arrayWithCycle()],
  ["an empty cross-realm object", (): unknown => runInNewContext("({})")],
  ["an empty Map", () => new Map()],
  ["an empty Set", () => new Set()],
  ["an empty URLSearchParams", () => new URLSearchParams()],
  ["an Error", () => new Error("boom")],
  ["an Error whose message getter throws", () => errorWithThrowingMessage()],
  ["an Error with a blank message", () => new Error(" \n")],
  [
    "an Error with a cause",
    () => new Error("outer", { cause: new Error("inner") }),
  ],
  ["an Error with no message", () => new Error()],
  ["an object holding a function", () => ({ a: 1, callback: () => 1 })],
  [
    "an object tagged as an Error",
    () => ({ message: "spoofed", [Symbol.toStringTag]: "Error" }),
  ],
  [
    "an object whose toJSON throws",
    () => ({
      toJSON: (): never => {
        throw new Error("toJSON trap");
      },
    }),
  ],
  ["an object with a cycle", () => objectWithCycle()],
  [
    "an object with a getter",
    () => ({
      get a(): number {
        return 1;
      },
    }),
  ],
  ["an object with a nested cycle", () => objectWithNestedCycle()],
  [
    "an object with an inherited message",
    (): unknown => Object.create({ message: "inherited" }),
  ],
  ["an object with a shared reference", () => objectWithSharedReference()],
  ["an object with a toJSON", () => ({ toJSON: () => "custom" })],
  [
    "an object with Symbol.toStringTag",
    () => ({ [Symbol.toStringTag]: "Custom" }),
  ],
  [
    "a null-prototype object with a",
    () => Object.assign(Object.create(null) as object, { a: 1 }),
  ],
  ["a proxy of a plain object", () => new Proxy({ a: 1 }, {})],
  ["a RegExp", () => /a/gu],
  ["a Set with an entry", () => new Set([1])],
  ["a sparse array", () => sparseArray()],
  ["a TypeError", () => new TypeError("bad type")],
  ["a Uint8Array", () => Uint8Array.of(1, 2)],
  ["a URL", () => new URL("https://example.com/")],
  ["a URLSearchParams with an entry", () => new URLSearchParams("a=1")],
  ["invalid UTF-8 bytes", () => Uint8Array.of(0x22, 0xff, 0x22)],
  [
    "UTF-16BE bytes of JSON text with a BOM",
    () =>
      Uint8Array.of(0xfe, 0xff, ...Buffer.from('{"a":1}', "utf16le").swap16()),
  ],
  [
    "UTF-16LE bytes of JSON text with a BOM",
    () => Uint8Array.of(0xff, 0xfe, ...Buffer.from('{"a":1}', "utf16le")),
  ],
  [
    "UTF-16LE bytes of JSON text without a BOM",
    () => Uint8Array.from(Buffer.from('{"a":1}', "utf16le")),
  ],
  ["UTF-8 bytes of JSON text", () => new TextEncoder().encode('{"a":1}')],
  [
    "UTF-8 bytes of JSON text with a BOM",
    () =>
      Uint8Array.of(0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"a":1}')),
  ],
]);

/** The locale the Node runtime resolved, reported with every column. */
const LOCALE = new Intl.DateTimeFormat().resolvedOptions().locale;

/** Every tool the Node adapter runs, in no particular order. */
const TOOLS: readonly Tool[] = [
  JS_BUILT_INS,
  LODASH,
  ES_TOOLKIT,
  REMEDA,
  ZOD,
  YN,
  IS_PLAIN_OBJ,
  YAML_1_1,
  YAML_1_2_CORE,
  ENVALID,
  JOI,
  YUP,
  UNDERSCORE,
  RAMDA,
  RADASH,
  EFFECT,
  SINDRESORHUS_IS,
  VALIBOT,
  VALIDATOR,
  JSON_FORMAT,
  TOML,
  CSV,
  INI,
  AJV_COERCE,
  HTML,
  SAFE_STABLE_STRINGIFY,
  FAST_SAFE_STRINGIFY,
  JSON_STRINGIFY_SAFE,
  FAST_JSON_STABLE_STRINGIFY,
  CANONICALIZE,
  ENSURE_ERROR,
];

/** Build an array whose second item is the array itself. */
function arrayWithCycle(): unknown[] {
  const array: unknown[] = [1];
  array.push(array);

  return array;
}

/** Build an `Error` whose `message` getter throws. */
function errorWithThrowingMessage(): Error {
  return Object.defineProperty(new Error("hidden"), "message", {
    get: (): never => {
      throw new Error("message trap");
    },
  });
}

/** Build `{ name: "a", self }`, where `self` is the object itself. */
function objectWithCycle(): Record<string, unknown> {
  const object: Record<string, unknown> = { name: "a" };
  object.self = object;

  return object;
}

/** Build `{ a: { b } }`, where `b` is the outer object. */
function objectWithNestedCycle(): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  object.a = { b: object };

  return object;
}

/** Build `{ a, b }`, where both keys hold the same, non-cyclic object. */
function objectWithSharedReference(): Record<string, unknown> {
  const shared = { x: 1 };

  return { a: shared, b: shared };
}

/** Build the value a `$js` tag names. */
function resolveJs(name: string): unknown {
  const factory = JS_FACTORIES.get(name);

  if (factory === undefined) {
    throw new Error(`no $js factory named "${name}"`);
  }

  return factory();
}

/** Run one probe on one case, catching whatever it throws. */
function runProbe({ args, probe }: ProbeRun): Outcome {
  const decoded = args.map((arg) => decodeValue({ encoded: arg, resolveJs }));

  if (probe.accepts && !probe.accepts(decoded)) {
    return { kind: "n/a" };
  }

  try {
    return { kind: "value", value: encodeValue(probe.run(decoded)) };
  } catch (error) {
    return { error: errorName(error), kind: "error" };
  }
}

/** Build `[1, <hole>, 3]`, an array with a missing index. */
function sparseArray(): unknown[] {
  const array: unknown[] = [];
  array[0] = 1;
  array[2] = 3;

  return array;
}

/** Run every tool's probes for a case file's function. */
function toColumns(caseFile: CaseFile): AdapterColumn[] {
  return TOOLS.flatMap((tool) =>
    (tool.functions[caseFile.function] ?? []).map((probe) => ({
      call: probe.call,
      function: caseFile.function,
      locale: LOCALE,
      name: tool.name,
      outcomes: caseFile.cases.map(({ args }) => runProbe({ args, probe })),
      tier: tool.tier,
      version: tool.version,
    }))
  );
}

/** The case files named on the command line, read and narrowed. */
const CASE_FILES = process.argv
  .slice(2)
  .map((file) => parseCaseFile(readJsonFile(file)));

// `JSON.stringify` can't throw: every outcome is already encoded, so nothing
// left holds a bigint, a cycle, or a `toJSON`.
process.stdout.write(
  JSON.stringify({
    columns: CASE_FILES.flatMap((caseFile) => toColumns(caseFile)),
  })
);
