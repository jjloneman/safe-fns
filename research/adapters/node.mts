import { bool } from "envalid";
import {
  isEmpty as esToolkitIsEmpty,
  toInteger as esToolkitToInteger,
  toNumber as esToolkitToNumber,
  toString as esToolkitToString,
} from "es-toolkit/compat";
import { isPlainObject as esToolkitIsPlainObject } from "es-toolkit/predicate";
import isPlainObj from "is-plain-obj";
import Joi from "joi";
import lodash from "lodash";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  isEmpty as remedaIsEmpty,
  isEmptyish as remedaIsEmptyish,
  isPlainObject as remedaIsPlainObject,
} from "remeda";
import { parse as parseYaml } from "yaml";
import yn from "yn";
import { boolean as yupBoolean } from "yup";
import { z } from "zod";

import type { EncodedValue } from "../../scripts/research/codec.ts";
import type {
  AdapterColumn,
  CaseFile,
  Outcome,
  Tier,
} from "../../scripts/research/results.ts";

import { decodeValue, encodeValue } from "../../scripts/research/codec.ts";
import { readJsonFile } from "../../scripts/research/json.ts";
import { parseCaseFile } from "../../scripts/research/results.ts";
import { crossRealmInputs } from "../../test/cross-realm-inputs.ts";
import { hostileInputs } from "../../test/hostile-inputs.ts";

/*
 * The Node adapter: runs each case file through JS built-ins and the npm
 * libraries in `research/package.json`, and prints the columns as JSON.
 *
 * - Usage: `node node.mts <case-file>…`, inside the `node` Compose service.
 *
 * - A `$js` case names a factory below, or an entry in the repo's own hostile
 *   and cross-realm test inputs.
 */

/** One expression a tool offers for a function. */
type Probe = {
  /**
   * Whether the call can take these arguments at all; `n/a` otherwise.
   *
   * @example `([value]) => typeof value === "string"`
   */
  accepts?: (args: readonly unknown[]) => boolean;

  /**
   * The expression, as the table header shows it.
   *
   * @example "yn(value)"
   */
  call: string;

  /**
   * Runs the expression on one case's decoded arguments.
   *
   * @example `([value]) => yn(value)`
   */
  run: (args: readonly unknown[]) => unknown;
};

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

/** A library or runtime, and its probes for each function. */
type Tool = {
  /**
   * Probes keyed by the function name in a case file.
   *
   * @example `{ safeParseBoolean: [{ call: "yn(value)", run }] }`
   */
  functions: Record<string, readonly Probe[]>;

  /**
   * The display name.
   *
   * @example "zod"
   */
  name: string;

  /**
   * The table tier.
   *
   * @example 1
   */
  tier: Tier;

  /**
   * The version, read from the installed package.
   *
   * @example "4.6.5"
   */
  version: string;
};

/*
 * The JS built-ins column's `JSON.parse`, typed `unknown`.
 *
 * - Called bare on purpose: it's the function under test, so its throw is the
 *   outcome to record, not an error to wrap.
 */
const callJsonParse = (text: string): unknown =>
  // eslint-disable-next-line no-restricted-properties -- the function under test
  JSON.parse(text);

/** Accept only a string first argument; other cases are `n/a`. */
const isString = ([value]: readonly unknown[]): boolean =>
  typeof value === "string";

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
  ...[...hostileInputs, ...crossRealmInputs].map(
    ({ description, value }) => [description, () => value] as const
  ),
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

// Typed wrappers: the yaml library returns `any`.
const parseYaml11 = (text: string): unknown =>
  parseYaml(text, { version: "1.1" });
const parseYaml12 = (text: string): unknown => parseYaml(text);

/** Every tool the Node adapter runs, in no particular order. */
const TOOLS: readonly Tool[] = [
  {
    functions: {
      codec: [{ call: "value", run: ([value]) => value }],
      safeObjectHasOwn: [
        {
          call: "Object.hasOwn(object, key)",
          run: ([object, key]) =>
            Object.hasOwn(object as object, key as string),
        },
        {
          call: "key in object",
          run: ([object, key]) => (key as string) in (object as object),
        },
      ],
      safeParseBoolean: [
        {
          accepts: isString,
          call: "JSON.parse(value)",
          run: ([value]) => callJsonParse(value as string),
        },
      ],
      safeParseInteger: [
        {
          call: "Number.parseInt(value, 10)",
          run: ([value]) => Number.parseInt(value as string, 10),
        },
      ],
      safeParseNumber: [
        { call: "Number(value)", run: ([value]) => Number(value) },
        {
          call: "Number.parseFloat(value)",
          run: ([value]) => Number.parseFloat(value as string),
        },
      ],
      safeParseString: [
        { call: "String(value)", run: ([value]) => String(value) },
        {
          call: "String(value).trim()",
          run: ([value]) => String(value).trim(),
        },
      ],
    },
    name: "JS built-ins",
    tier: 1,
    version: process.version,
  },
  {
    functions: {
      isPlainObject: [
        {
          call: "_.isPlainObject(value)",
          run: ([value]) => lodash.isPlainObject(value),
        },
      ],
      isSafeEmpty: [
        { call: "_.isEmpty(value)", run: ([value]) => lodash.isEmpty(value) },
      ],
      safeObjectHasOwn: [
        {
          call: "_.has(object, key)",
          run: ([object, key]) => lodash.has(object, key as string),
        },
      ],
      safeParseInteger: [
        {
          call: "_.toInteger(value)",
          run: ([value]) => lodash.toInteger(value),
        },
        {
          call: "_.toSafeInteger(value)",
          run: ([value]) => lodash.toSafeInteger(value),
        },
      ],
      safeParseNumber: [
        { call: "_.toNumber(value)", run: ([value]) => lodash.toNumber(value) },
      ],
      safeParseString: [
        { call: "_.toString(value)", run: ([value]) => lodash.toString(value) },
      ],
    },
    name: "lodash",
    tier: 1,
    version: packageVersion("lodash"),
  },
  {
    functions: {
      isPlainObject: [
        {
          call: "isPlainObject(value)",
          run: ([value]) => esToolkitIsPlainObject(value),
        },
      ],
      isSafeEmpty: [
        {
          call: "compat.isEmpty(value)",
          run: ([value]) => esToolkitIsEmpty(value),
        },
      ],
      safeParseInteger: [
        {
          call: "compat.toInteger(value)",
          run: ([value]) => esToolkitToInteger(value),
        },
      ],
      safeParseNumber: [
        {
          call: "compat.toNumber(value)",
          run: ([value]) => esToolkitToNumber(value),
        },
      ],
      safeParseString: [
        {
          call: "compat.toString(value)",
          run: ([value]) => esToolkitToString(value),
        },
      ],
    },
    name: "es-toolkit",
    tier: 1,
    version: packageVersion("es-toolkit"),
  },
  {
    functions: {
      isPlainObject: [
        {
          call: "isPlainObject(value)",
          run: ([value]) => remedaIsPlainObject(value),
        },
      ],
      isSafeEmpty: [
        {
          call: "isEmpty(value)",
          run: ([value]) => remedaIsEmpty(value as string),
        },
        {
          call: "isEmptyish(value)",
          run: ([value]) => remedaIsEmptyish(value),
        },
      ],
    },
    name: "remeda",
    tier: 1,
    version: packageVersion("remeda"),
  },
  {
    functions: {
      safeParseBoolean: [
        {
          call: "z.stringbool().parse(value)",
          run: ([value]) => z.stringbool().parse(value),
        },
      ],
      safeParseInteger: [
        {
          call: "z.coerce.number().int().parse(value)",
          run: ([value]) => z.coerce.number().int().parse(value),
        },
      ],
      safeParseNumber: [
        {
          call: "z.coerce.number().parse(value)",
          run: ([value]) => z.coerce.number().parse(value),
        },
      ],
      safeParseString: [
        {
          call: "z.coerce.string().parse(value)",
          run: ([value]) => z.coerce.string().parse(value),
        },
      ],
    },
    name: "zod",
    tier: 1,
    version: packageVersion("zod"),
  },
  {
    functions: {
      safeParseBoolean: [{ call: "yn(value)", run: ([value]) => yn(value) }],
    },
    name: "yn",
    tier: 1,
    version: packageVersion("yn"),
  },
  {
    functions: {
      isPlainObject: [
        { call: "isPlainObject(value)", run: ([value]) => isPlainObj(value) },
      ],
    },
    name: "is-plain-obj",
    tier: 1,
    version: packageVersion("is-plain-obj"),
  },
  {
    functions: {
      safeParseBoolean: [
        {
          accepts: isString,
          call: 'parse(value, { version: "1.1" })',
          run: ([value]) => parseYaml11(value as string),
        },
      ],
      safeParseInteger: [
        {
          accepts: isString,
          call: 'parse(value, { version: "1.1" })',
          run: ([value]) => parseYaml11(value as string),
        },
      ],
      safeParseNumber: [
        {
          accepts: isString,
          call: 'parse(value, { version: "1.1" })',
          run: ([value]) => parseYaml11(value as string),
        },
      ],
    },
    name: "YAML 1.1",
    tier: 3,
    version: packageVersion("yaml"),
  },
  {
    functions: {
      safeParseBoolean: [
        {
          accepts: isString,
          call: "parse(value)",
          run: ([value]) => parseYaml12(value as string),
        },
      ],
      safeParseInteger: [
        {
          accepts: isString,
          call: "parse(value)",
          run: ([value]) => parseYaml12(value as string),
        },
      ],
      safeParseNumber: [
        {
          accepts: isString,
          call: "parse(value)",
          run: ([value]) => parseYaml12(value as string),
        },
      ],
    },
    name: "YAML 1.2 core",
    tier: 3,
    version: packageVersion("yaml"),
  },
  {
    functions: {
      safeParseBoolean: [
        {
          accepts: isString,
          call: "bool()._parse(value)",
          run: ([value]) => bool()._parse(value as string),
        },
      ],
    },
    name: "envalid",
    tier: 4,
    version: packageVersion("envalid"),
  },
  {
    functions: {
      safeParseBoolean: [
        {
          call: "Joi.attempt(value, Joi.boolean())",
          run: ([value]) => Joi.attempt(value, Joi.boolean()),
        },
      ],
    },
    name: "joi",
    tier: 4,
    version: packageVersion("joi"),
  },
  {
    functions: {
      safeParseBoolean: [
        {
          call: "boolean().validateSync(value)",
          run: ([value]) => yupBoolean().validateSync(value),
        },
      ],
    },
    name: "yup",
    tier: 4,
    version: packageVersion("yup"),
  },
];

/** Name a thrown value's class, without trusting it to be inspectable. */
function errorName(error: unknown): string {
  try {
    if (!(error instanceof Error)) {
      return typeof error;
    }

    // Prefer `name`: some libraries throw instances of anonymous classes.
    return error.name || error.constructor.name;
  } catch {
    return "an uninspectable error";
  }
}

/** Read an installed library's version. */
function packageVersion(name: string): string {
  // Read from disk: some packages leave `package.json` out of `exports`.
  const manifest = readJsonFile(
    fileURLToPath(
      new URL(`../node_modules/${name}/package.json`, import.meta.url)
    )
  );

  return typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
    ? manifest.version
    : "unknown";
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
