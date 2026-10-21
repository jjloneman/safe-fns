import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type {
  AdapterColumn,
  CaseFile,
  Outcome,
} from "../../scripts/research/results.ts";

import { encodeValue } from "../../scripts/research/codec.ts";
import { readJsonFile } from "../../scripts/research/json.ts";
import { parseCaseFile } from "../../scripts/research/results.ts";
import { decodeWithoutFactories, errorName } from "./node/tool.mts";

/*
 * The AssemblyScript adapter: runs each case file through the probes in
 * `assemblyscript/probes.ts`, compiled to Wasm, and prints the columns as
 * JSON.
 *
 * - Usage: `node assemblyscript.mts <case-file>…`, inside the
 *   `assemblyscript` Compose service, whose image compiles the probes with
 *   `asc --bindings raw`.
 *
 * - The probes take one statically typed parameter, so only a boolean,
 *   number, or string case reaches them; anything else (`undefined`, `null`,
 *   a bigint, an object, a `$js` value) is `n/a`.
 *
 * - An AssemblyScript `throw` aborts its Wasm instance, so the calls run one
 *   at a time on a live instance, which is replaced after any abort or trap;
 *   one case's abort can't leak into the next.
 */

/** The probes' exports, as `probes.ts` names them. */
type ExportName =
  | "boolIdentity"
  | "boolParse"
  | "boolToString"
  | "boolToStringTrim"
  | "f32Parse"
  | "f64DateToIsoString"
  | "f64Identity"
  | "f64ParseFloat"
  | "f64ParseInt"
  | "f64ToString"
  | "f64ToStringTrim"
  | "i32Parse"
  | "i64Parse"
  | "stringDateFromString"
  | "stringDecodeUri"
  | "stringDecodeUriComponent"
  | "stringEncodeUri"
  | "stringEncodeUriComponent"
  | "stringIdentity"
  | "stringTrim";

/** The generated bindings' module, whose glue lowers and lifts each value. */
type ProbeBindings = {
  /**
   * Instantiate the compiled probes, wrapping each export in its glue.
   *
   * @example `instantiate(module)`
   */
  instantiate: (module: WebAssembly.Module) => Promise<ProbeExports>;
};

/** One AssemblyScript call, as one column. */
type ProbeColumn = {
  /**
   * The call, as the table header shows it.
   *
   * @example "parseInt(value, 10)"
   */
  call: string;

  /**
   * The export that makes the call, for each type of value it takes; any
   * other type is `n/a`.
   *
   * @example `{ string: "f64ParseInt" }`
   */
  exportsByType: Partial<Record<ValueType, ExportName>>;
};

/** One instance's exports, each wrapped in the bindings' glue. */
type ProbeExports = Readonly<Record<ExportName, (value: unknown) => unknown>>;

/** A case's input to one call: the decoded arguments, and the probe. */
type ProbeInput = {
  /**
   * The case's arguments, decoded.
   *
   * @example `["42"]`
   */
  args: readonly unknown[];

  /**
   * The column whose call runs.
   *
   * @example `{ call: "i32.parse(value, 10)", exportsByType: { string: "i32Parse" } }`
   */
  probe: ProbeColumn;
};

/** A JavaScript value type that one of AssemblyScript's types can hold. */
type ValueType = (typeof VALUE_TYPES)[number];

/** Where the image puts the compiled probes and their bindings. */
const BUILD_DIRECTORY = "/opt/assemblyscript/build";

/** Every probe, keyed by the function name in a case file. */
const PROBES: Readonly<Record<string, readonly ProbeColumn[]>> = {
  codec: [
    {
      call: "value",
      exportsByType: {
        boolean: "boolIdentity",
        number: "f64Identity",
        string: "stringIdentity",
      },
    },
  ],
  safeDateToIsoString: [
    {
      call: "new Date(i64(value)).toISOString()",
      exportsByType: { number: "f64DateToIsoString" },
    },
  ],
  safeDecodeUriComponent: [
    {
      call: "decodeURI(value)",
      exportsByType: { string: "stringDecodeUri" },
    },
    {
      call: "decodeURIComponent(value)",
      exportsByType: { string: "stringDecodeUriComponent" },
    },
  ],
  safeEncodeUriComponent: [
    {
      call: "encodeURI(value)",
      exportsByType: { string: "stringEncodeUri" },
    },
    {
      call: "encodeURIComponent(value)",
      exportsByType: { string: "stringEncodeUriComponent" },
    },
  ],
  safeParseBigInt: [
    { call: "i64.parse(value, 10)", exportsByType: { string: "i64Parse" } },
  ],
  safeParseBoolean: [
    { call: "bool.parse(value)", exportsByType: { string: "boolParse" } },
  ],
  safeParseDate: [
    {
      call: "Date.fromString(value).toISOString()",
      exportsByType: { string: "stringDateFromString" },
    },
  ],
  safeParseInt: [
    { call: "parseInt(value, 10)", exportsByType: { string: "f64ParseInt" } },
    { call: "i32.parse(value, 10)", exportsByType: { string: "i32Parse" } },
    { call: "i64.parse(value, 10)", exportsByType: { string: "i64Parse" } },
  ],
  safeParseNumber: [
    { call: "parseFloat(value)", exportsByType: { string: "f64ParseFloat" } },
    { call: "f32.parse(value)", exportsByType: { string: "f32Parse" } },
  ],
  safeParseString: [
    {
      call: "value.toString()",
      exportsByType: {
        boolean: "boolToString",
        number: "f64ToString",
        string: "stringIdentity",
      },
    },
    {
      call: "value.toString().trim()",
      exportsByType: {
        boolean: "boolToStringTrim",
        number: "f64ToStringTrim",
        string: "stringTrim",
      },
    },
  ],
};

/** The value types an AssemblyScript parameter can take from a case. */
const VALUE_TYPES = ["boolean", "number", "string"] as const;

const VALUE_TYPE_SET: ReadonlySet<string> = new Set(VALUE_TYPES);

/** The compiler release that built the probes, from its own banner. */
const VERSION =
  /Version (?<version>\S+)/u.exec(
    execFileSync("asc", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  )?.groups?.version ?? "unknown";

/**
 * Check that the generated bindings export `instantiate`.
 *
 * @returns whether `value` is the bindings module.
 */
function isProbeBindings(value: unknown): value is ProbeBindings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "instantiate") === "function"
  );
}

/**
 * Check for a type one of AssemblyScript's parameter types can hold.
 *
 * @returns whether `value` names one.
 */
function isValueType(value: string): value is ValueType {
  return VALUE_TYPE_SET.has(value);
}

/**
 * Import the generated bindings, typed `unknown` until they're narrowed.
 *
 * @returns the bindings module.
 */
async function loadBindings(): Promise<unknown> {
  return import(pathToFileURL(`${BUILD_DIRECTORY}/probes.js`).href);
}

/**
 * Run one call on one case, on the live Wasm instance.
 *
 * - Callers run one call at a time, so no call can pick up an instance that
 *   another call's abort just poisoned.
 *
 * @returns the outcome; a Wasm abort or trap is an error, and retires the
 *   instance.
 */
async function runProbe({ args, probe }: ProbeInput): Promise<Outcome> {
  const [value] = args;
  const valueType = typeof value;

  const exportName =
    args.length === 1 && isValueType(valueType)
      ? probe.exportsByType[valueType]
      : undefined;

  if (exportName === undefined) {
    return { kind: "n/a" };
  }

  // Outside the `try`, so a broken build fails the run instead of every case.
  liveExports ??= await BINDINGS.instantiate(MODULE);

  try {
    return {
      kind: "value",
      value: encodeValue(liveExports[exportName](value)),
    };
  } catch (error) {
    liveExports = undefined;

    return { error: errorName(error), kind: "error" };
  }
}

/**
 * Run one case file through the probes, as columns.
 *
 * - A plain loop, so each call finishes before the next starts (see
 *   `runProbe`).
 */
async function toColumns(caseFile: CaseFile): Promise<AdapterColumn[]> {
  const caseArguments = caseFile.cases.map(({ args }) =>
    decodeWithoutFactories(args)
  );

  const columns: AdapterColumn[] = [];

  for (const probe of PROBES[caseFile.function] ?? []) {
    const outcomes: Outcome[] = [];

    for (const args of caseArguments) {
      outcomes.push(await runProbe({ args, probe }));
    }

    columns.push({
      call: probe.call,
      function: caseFile.function,
      locale: "-",
      name: "AssemblyScript",
      outcomes,
      tier: 4,
      version: VERSION,
    });
  }

  return columns;
}

const BINDINGS_MODULE = await loadBindings();

if (!isProbeBindings(BINDINGS_MODULE)) {
  throw new Error(
    `[assemblyscript] ${BUILD_DIRECTORY}/probes.js has no bindings`
  );
}

const BINDINGS: ProbeBindings = BINDINGS_MODULE;

/** The compiled probes, compiled once and instantiated again after an abort. */
const MODULE = await WebAssembly.compile(
  await readFile(`${BUILD_DIRECTORY}/probes.wasm`)
);

/** The live instance's exports; `undefined` until the next call needs one. */
let liveExports: ProbeExports | undefined;

/** The case files named on the command line, read and narrowed. */
const CASE_FILES = process.argv
  .slice(2)
  .map((file) => parseCaseFile(readJsonFile(file)));

const COLUMNS: AdapterColumn[] = [];

// One file at a time, for the same reason as `toColumns`.
for (const caseFile of CASE_FILES) {
  COLUMNS.push(...(await toColumns(caseFile)));
}

process.stdout.write(JSON.stringify({ columns: COLUMNS }));
