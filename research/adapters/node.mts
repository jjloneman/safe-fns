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
import { CSV } from "./node/csv.mts";
import { EFFECT } from "./node/effect.mts";
import { ENVALID } from "./node/envalid.mts";
import { ES_TOOLKIT } from "./node/es-toolkit.mts";
import { HTML } from "./node/html.mts";
import { INI } from "./node/ini.mts";
import { IS_PLAIN_OBJ } from "./node/is-plain-obj.mts";
import { JOI } from "./node/joi.mts";
import { JS_BUILT_INS } from "./node/js-built-ins.mts";
import { JSON_FORMAT } from "./node/json.mts";
import { LODASH } from "./node/lodash.mts";
import { RADASH } from "./node/radash.mts";
import { RAMDA } from "./node/ramda.mts";
import { REMEDA } from "./node/remeda.mts";
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
  ["a boxed bigint", (): unknown => Object(1n)],
  ["a boxed blank string", () => new String("   ")],
  ["a boxed false", () => new Boolean(false)],
  ["a boxed number", () => new Number(1)],
  ["a boxed numeric string", () => new String(" 42 ")],
  ["a boxed string", () => new String("hi")],
  ["a boxed true", () => new Boolean(true)],
  [
    "a class instance",
    () =>
      new (class Point {
        readonly x = 1;
      })(),
  ],
  ["a Date", () => new Date(0)],
  ["a function", () => () => undefined],
  ["a Map with an entry", () => new Map([["a", 1]])],
  ["an empty cross-realm object", (): unknown => runInNewContext("({})")],
  ["an empty Map", () => new Map()],
  ["an empty Set", () => new Set()],
  ["an empty URLSearchParams", () => new URLSearchParams()],
  [
    "an object with Symbol.toStringTag",
    () => ({ [Symbol.toStringTag]: "Custom" }),
  ],
  [
    "a null-prototype object with a",
    () => Object.assign(Object.create(null) as object, { a: 1 }),
  ],
  ["a proxy of a plain object", () => new Proxy({ a: 1 }, {})],
  ["a URLSearchParams with an entry", () => new URLSearchParams("a=1")],
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
];

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
