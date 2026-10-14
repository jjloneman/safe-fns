import { execFileSync } from "node:child_process";

import type {
  AdapterColumn,
  CaseEntry,
  CaseFile,
} from "../../scripts/research/results.ts";

import { decodeValue, ENCODER_SOURCE } from "../../scripts/research/codec.ts";
import { parseJson, readJsonFile } from "../../scripts/research/json.ts";
import {
  parseAdapterOutput,
  parseCaseFile,
} from "../../scripts/research/results.ts";
import { errorName } from "./node/tool.mts";

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
   * The expression, as the table header shows it, and as Hermes runs it with
   * the case's arguments bound to `parameters`.
   *
   * @example "Number(value)"
   */
  call: string;

  /**
   * Whether the call takes a string only; other cases are `n/a`.
   *
   * @example true
   */
  isStringOnly?: boolean;

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
  safeObjectHasOwn: [
    { call: "Object.hasOwn(object, key)", parameters: ["object", "key"] },
    { call: "key in object", parameters: ["object", "key"] },
  ],
  safeParseBoolean: [{ call: "JSON.parse(value)", isStringOnly: true }],
  safeParseInteger: [{ call: "Number.parseInt(value, 10)" }],
  safeParseNumber: [
    { call: "Number(value)" },
    { call: "Number.parseFloat(value)" },
  ],
  safeParseString: [
    { call: "String(value)" },
    { call: "String(value).trim()" },
  ],
};

/**
 * What a `$js` case decodes to: Hermes can't rebuild a value that only the
 * Node adapter's factories make, so its case is `n/a`.
 */
const UNBUILDABLE = Symbol("unbuildable");

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
  return listSource(
    args.map((encoded) =>
      decodeValue({ encoded, resolveJs: () => UNBUILDABLE })
    )
  );
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
    ({ call, isStringOnly = false, parameters = ["value"] }) =>
      `{ isStringOnly: ${String(isStringOnly)}, run: function (${parameters.join(", ")}) { return ${call}; } }`
  );

  const cases = caseFile.cases.map(
    ({ args }) => argumentsSource(args) ?? "undefined"
  );

  return `${ENCODER_SOURCE}

${String(errorName)}

function runProbe(probe, args) {
  if (args === undefined || (probe.isStringOnly && typeof args[0] !== "string")) {
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
