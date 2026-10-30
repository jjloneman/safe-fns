import { execFileSync } from "node:child_process";

import type {
  AdapterColumn,
  CaseEntry,
  CaseFile,
} from "../../scripts/research/results.ts";

import { ENCODER_SOURCE } from "../../scripts/research/codec.ts";
import { parseJson, readJsonFile } from "../../scripts/research/json.ts";
import {
  parseAdapterOutput,
  parseCaseFile,
} from "../../scripts/research/results.ts";
import { decodeWithoutFactories, errorName } from "./node/tool.mts";

/*
 * The Hermes adapter: runs each case file through Hermes, React Native's
 * JavaScript engine, and prints the columns as JSON.
 *
 * - Usage: `node hermes.mts <case-file>…`, inside the `hermes` Compose
 *   service, whose image adds the Hermes CLI to the pinned Node image.
 *
 * - Hermes has no file system or module loader, so this driver writes each
 *   case file out as one self-contained program, with the cases as literals
 *   and the shared encoder's own source, and pipes it to `hermes -`.
 *
 * - A `$js` value can't be rebuilt from source, so its case is `n/a`.
 */

/** One expression Hermes runs for a function, as JavaScript source. */
type HermesProbe = {
  /**
   * The `typeof` each argument must have, in order, and so how many there
   * are; a case whose arguments don't match is `n/a`, as the JS built-ins
   * column's `accepts` makes it.
   *
   * - `"any"` accepts every type, so a probe can fix only the count.
   *
   * @example `["string", "number"]`
   */
  argumentTypes?: readonly string[];

  /**
   * The expression, as the table header shows it, and as Hermes runs it with
   * the case's arguments bound to `parameters`.
   *
   * @example "Number(value)"
   */
  call: string;

  /**
   * The keys a case's last argument, an options object, must hold exactly;
   * a case with other options is `n/a`.
   *
   * @example `["locale"]`
   */
  optionKeys?: readonly string[];

  /**
   * The names the case's arguments are bound to, in order; the JS built-ins
   * column's names, so the two columns' headers match.
   *
   * @example `["object", "key"]`
   */
  parameters?: readonly string[];
};

/**
 * Every probe, keyed by the function name in a case file.
 *
 * - The JS built-ins column's calls, so the two engines compare directly.
 */
const PROBES: Readonly<Record<string, readonly HermesProbe[]>> = {
  codec: [{ call: "value" }],
  decodeBase64: [{ argumentTypes: ["string"], call: "atob(value)" }],
  deepClone: [
    { argumentTypes: ["any"], call: "JSON.parse(JSON.stringify(value))" },
  ],
  deepSortObject: [
    { argumentTypes: ["string"], call: "JSON.stringify(JSON.parse(value))" },
  ],
  encodeBase64: [{ call: "btoa(value)" }],
  isDeepEqual: [
    {
      argumentTypes: ["any", "any"],
      call: "JSON.stringify(a) === JSON.stringify(b)",
      parameters: ["a", "b"],
    },
  ],
  lowerFirst: [
    {
      argumentTypes: ["string"],
      call: "value.charAt(0).toLowerCase() + value.slice(1)",
    },
    {
      argumentTypes: ["string", "object"],
      call: "value.charAt(0).toLocaleLowerCase(options.locale) + value.slice(1)",
      optionKeys: ["locale"],
      parameters: ["value", "options"],
    },
  ],
  pluralize: [
    {
      argumentTypes: ["string", "number"],
      call: 'new Intl.PluralRules("en").select(count)',
      parameters: ["word", "count"],
    },
  ],
  safeDateToIsoString: [{ call: "new Date(value).toISOString()" }],
  safeDecodeUriComponent: [
    { call: "decodeURIComponent(value)" },
    { call: "decodeURI(value)" },
  ],
  safeEncodeUriComponent: [
    { call: "encodeURIComponent(value)" },
    { call: "encodeURI(value)" },
  ],
  safeJsonStringify: [{ call: "JSON.stringify(value)" }],
  safeObjectHasOwn: [
    { call: "Object.hasOwn(object, key)", parameters: ["object", "key"] },
    { call: "key in object", parameters: ["object", "key"] },
  ],
  safeParseBigInt: [{ call: "BigInt(value)" }],
  safeParseBoolean: [{ argumentTypes: ["string"], call: "JSON.parse(value)" }],
  safeParseDate: [{ call: "new Date(value).toISOString()" }],
  safeParseInt: [{ call: "Number.parseInt(value, 10)" }],
  safeParseJson: [{ call: "JSON.parse(value)" }],
  safeParseNumber: [
    { call: "Number(value)" },
    { call: "Number.parseFloat(value)" },
  ],
  safeParseRegExp: [
    {
      call: "String(new RegExp(value, flags))",
      parameters: ["value", "flags"],
    },
  ],
  safeParseString: [
    { call: "String(value)" },
    { call: "String(value).trim()" },
  ],
  safeParseUrl: [
    { call: "new URL(value, base).href", parameters: ["value", "base"] },
  ],
  safeStructuredClone: [{ call: "structuredClone(value)" }],
  toBasicAscii: [
    {
      argumentTypes: ["string"],
      call: 'value.normalize("NFD").replace(/\\p{M}/gu, "")',
    },
    {
      argumentTypes: ["string"],
      call: 'value.normalize("NFKD").replace(/\\p{M}/gu, "")',
    },
  ],
  trimBlank: [{ argumentTypes: ["string"], call: "value.trim()" }],
  upperFirst: [
    {
      argumentTypes: ["string"],
      call: "value.charAt(0).toUpperCase() + value.slice(1)",
    },
    {
      argumentTypes: ["string", "object"],
      call: "value.charAt(0).toLocaleUpperCase(options.locale) + value.slice(1)",
      optionKeys: ["locale"],
      parameters: ["value", "options"],
    },
  ],
};

/** The Hermes release that actually ran, from its own banner. */
const VERSION =
  /Hermes release version: (?<version>\S+)/u.exec(
    execFileSync("hermes", ["-version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  )?.groups?.version ?? "unknown";

/**
 * Write a case's arguments as one JavaScript array literal, decoding them
 * with the shared codec first, so its tags are read in one place.
 *
 * @returns the source, or `undefined` when an argument can't be rebuilt.
 */
function argumentsSource(args: CaseEntry["args"]): string | undefined {
  return listSource(decodeWithoutFactories(args));
}

/**
 * Write a list of decoded values as a JavaScript array literal.
 *
 * @returns the source, or `undefined` when an item can't be rebuilt.
 */
function listSource(items: readonly unknown[]): string | undefined {
  const sources = items.map((item) => valueSource(item));

  return sources.every((source) => source !== undefined)
    ? `[${sources.join(", ")}]`
    : undefined;
}

/**
 * Write a plain object as an object literal.
 *
 * - Keys are computed (`["__proto__"]: …`), so no key can set a prototype.
 *
 * @returns the source, or `undefined` when an entry can't be rebuilt.
 */
function objectSource(object: object): string | undefined {
  const sources = Object.entries(object).map(([key, item]) => {
    const itemSource = valueSource(item);

    return itemSource === undefined
      ? undefined
      : `[${JSON.stringify(key)}]: ${itemSource}`;
  });

  return sources.every((source) => source !== undefined)
    ? `{ ${sources.join(", ")} }`
    : undefined;
}

/** Build the program that runs one case file's probes and prints outcomes. */
function programSource(caseFile: CaseFile): string {
  const probes = (PROBES[caseFile.function] ?? []).map(
    ({ argumentTypes = [], call, optionKeys, parameters = ["value"] }) =>
      `{ argumentTypes: ${JSON.stringify(argumentTypes)}, optionKeys: ${JSON.stringify(optionKeys ?? null)}, run: function (${parameters.join(", ")}) { return ${call}; } }`
  );

  const cases = caseFile.cases.map(
    ({ args }) => argumentsSource(args) ?? "undefined"
  );

  return `${ENCODER_SOURCE}

${String(errorName)}

function runProbe(probe, args) {
  if (args === undefined || (probe.argumentTypes.length > 0 && (args.length !== probe.argumentTypes.length || !probe.argumentTypes.every(function (type, index) { return type === "any" || typeof args[index] === type; }))) || (probe.optionKeys !== null && (args[args.length - 1] === null || Object.keys(args[args.length - 1]).sort().join() !== probe.optionKeys.slice().sort().join()))) {
    return { kind: "n/a" };
  }

  try {
    return { kind: "value", value: encodeValue(probe.run.apply(undefined, args)) };
  } catch (error) {
    return { error: errorName(error), kind: "error" };
  }
}

var PROBES = [${probes.join(",\n")}];

var CASES = [${cases.join(",\n")}];

print(JSON.stringify(PROBES.map(function (probe) {
  return CASES.map(function (args) { return runProbe(probe, args); });
})));
`;
}

/** Run one case file through Hermes, as columns. */
function toColumns(caseFile: CaseFile): AdapterColumn[] {
  const probes = PROBES[caseFile.function] ?? [];

  if (probes.length === 0) {
    return [];
  }

  const outcomesByProbe = parseJson({
    source: `hermes (${caseFile.function})`,
    text: execFileSync("hermes", ["-"], {
      encoding: "utf8",
      input: programSource(caseFile),
      stdio: ["pipe", "pipe", "pipe"],
    }),
  });

  const outcomes: readonly unknown[] = Array.isArray(outcomesByProbe)
    ? outcomesByProbe
    : [];

  // Narrowed by the shared parser, so Hermes' output is checked like any other.
  return parseAdapterOutput({
    columns: probes.map(({ call }, index): unknown => ({
      call,
      function: caseFile.function,
      locale: "-",
      name: "Hermes",
      outcomes: outcomes[index],
      tier: 1,
      version: VERSION,
    })),
  });
}

/**
 * Write one decoded value as the JavaScript source that builds it.
 *
 * @returns the source, or `undefined` for a value source can't spell: a
 *   `$js` value, which decodes to `UNBUILDABLE`.
 */
function valueSource(value: unknown): string | undefined {
  switch (typeof value) {
    case "bigint": {
      return `BigInt(${JSON.stringify(String(value))})`;
    }

    case "boolean":
    case "undefined": {
      return String(value);
    }

    case "number": {
      // `String` spells NaN and the infinities as their globals' names.
      return Object.is(value, -0) ? "-0" : String(value);
    }

    case "object": {
      if (value === null) {
        return "null";
      }

      return Array.isArray(value) ? listSource(value) : objectSource(value);
    }

    case "string": {
      return JSON.stringify(value);
    }

    default: {
      return undefined;
    }
  }
}

/** The case files named on the command line, read and narrowed. */
const CASE_FILES = process.argv
  .slice(2)
  .map((file) => parseCaseFile(readJsonFile(file)));

process.stdout.write(
  JSON.stringify({
    columns: CASE_FILES.flatMap((caseFile) => toColumns(caseFile)),
  })
);
