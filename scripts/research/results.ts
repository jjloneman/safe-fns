import type { EncodedValue } from "./codec.ts";

import { isRecord } from "./codec.ts";

/** One adapter's answer for one function, before the runner adds its origin. */
export type AdapterColumn = {
  /**
   * The function the column answers for, as named in its case file.
   *
   * @example "safeParseBoolean"
   */
  function: string;
} & ColumnCore;

/** The input to `buildResults`. */
export type BuildResultsInput = {
  /**
   * The case files the run covered.
   *
   * @example `[{ cases: [{ args: ["yes"] }], function: "safeParseBoolean" }]`
   */
  caseFiles: readonly CaseFile[];

  /**
   * What each adapter service printed.
   *
   * @example `[{ columns: [], image: "python:3.14.7…", service: "python" }]`
   */
  serviceColumns: readonly ServiceColumns[];
};

/** One case: the arguments to pass, and safe-fns' planned answer. */
export type CaseEntry = {
  /**
   * The arguments, each in the portable format.
   *
   * @example `[" yes "]`
   */
  args: EncodedValue[];

  /**
   * What safe-fns plans to return, when its decision record settles it.
   *
   * - A `{ "$utf16": [codeUnit, …] }` tag in it is decoded to the string
   *   those code units spell.
   *
   * @example true
   */
  expected?: EncodedValue;
};

/** The parsed contents of `research/cases/<function>.json`. */
export type CaseFile = {
  /**
   * The cases, in the order the tables list them.
   *
   * @example `[{ args: ["yes"], expected: true }]`
   */
  cases: CaseEntry[];

  /**
   * The function the cases exercise, or `codec` for the round-trip check.
   *
   * @example "safeParseBoolean"
   */
  function: string;
};

/** Every column for one function, as written to `research/results/`. */
export type FunctionResult = {
  /**
   * Each case's arguments, in case-file order.
   *
   * @example `[["yes"], [{ "$undefined": true }]]`
   */
  cases: CaseEntry["args"][];

  /**
   * The columns, ordered by tier, then name, then call.
   *
   * @example `[{ call: "yn(value)", name: "yn", tier: 1, … }]`
   */
  columns: ResultColumn[];
} & Pick<CaseFile, "function">;

/** The input to `mergeWithPrevious`. */
export type MergeInput = {
  /**
   * The result the narrowed run just built.
   *
   * @example `{ cases: [["yes"]], columns: [], function: "safeParseBoolean" }`
   */
  next: FunctionResult;

  /**
   * The committed result, or `undefined` when there is none yet.
   *
   * @example `{ cases: [["yes"]], columns: [], function: "safeParseBoolean" }`
   */
  previous: FunctionResult | undefined;

  /**
   * The services the narrowed run ran, whose columns it replaces.
   *
   * @example `new Set(["python", "sqlite"])`
   */
  servicesRun: ReadonlySet<string>;
};

/**
 * What one call did with one case.
 *
 * - Each `kind` documents itself without an `@example`: its only value is
 *   its type.
 */
export type Outcome =
  | {
      /**
       * The thrown value's class name.
       *
       * @example "ZodError"
       */
      error: string;

      /** The call threw. */
      kind: "error";
    }
  | {
      /** The call returned. */
      kind: "value";

      /**
       * The returned value, in the portable format.
       *
       * @example `{ "$undefined": true }`
       */
      value: EncodedValue;
    }
  | {
      /** The tool can't express the case's input. */
      kind: "n/a";
    };

/** One column of a comparison table: one call in one tool. */
export type ResultColumn = {
  /**
   * The pinned image the tool ran in, or `-` for the planned column.
   *
   * @example `"node:26.9.0-bookworm-slim@sha256:…"`
   */
  image: string;

  /**
   * The fingerprint of the files its service depended on, from
   * `toServiceInputs`; absent on the planned column.
   *
   * @example `"sha256:3b5d…"`
   */
  inputs?: string;

  /**
   * The Compose service that produced the column, or `-` for the planned
   * column; a narrowed run replaces only the columns of the services it ran.
   *
   * @example "node"
   */
  service: string;
} & ColumnCore;

/** The columns one Compose service printed, as the runner collected them. */
export type ServiceColumns = {
  /**
   * The columns the adapter printed.
   *
   * @example `[{ call: "yn(value)", function: "safeParseBoolean", … }]`
   */
  columns: AdapterColumn[];
} & Pick<ResultColumn, "image" | "service"> &
  Required<Pick<ResultColumn, "inputs">>;

/**
 * A table tier; 0 is safe-fns' own planned column.
 *
 * - research/README.md's Tiers section defines each one; the summary table
 *   shows tiers 0–2.
 */
export type Tier = (typeof TIERS)[number];

/** The fields every column shares, in adapter output and in results alike. */
type ColumnCore = {
  /**
   * The expression each case ran through.
   *
   * @example "z.stringbool().parse(value)"
   */
  call: string;

  /**
   * The locale the tool reported.
   *
   * @example "C.UTF-8"
   */
  locale: string;

  /**
   * The tool's display name.
   *
   * @example "zod"
   */
  name: string;

  /**
   * One outcome per case, in case-file order.
   *
   * @example `[{ kind: "value", value: true }, { kind: "n/a" }]`
   */
  outcomes: Outcome[];

  /**
   * The cached excerpt a docs-only column was transcribed from, relative to
   * the repo root; absent from a column a tool produced by running.
   *
   * @example "research/sources/excel.md"
   */
  source?: string;

  /**
   * The column's tier, which orders the tables; 0 is safe-fns itself.
   *
   * @example 1
   */
  tier: Tier;

  /**
   * The tool's version.
   *
   * @example "4.6.5"
   */
  version: string;
};

/** A value to narrow into a column, and its position for error messages. */
type ColumnToParse = {
  /**
   * The column, as parsed from JSON.
   *
   * @example `{ call: "yn(value)", … }`
   */
  column: unknown;

  /**
   * The column's position in its list.
   *
   * @example 0
   */
  index: number;
};

/** An adapter column, and the service, image, and inputs it ran with. */
type ColumnWithOrigin = {
  /**
   * The column the adapter printed.
   *
   * @example `{ call: "yn(value)", function: "safeParseBoolean", … }`
   */
  column: AdapterColumn;
} & Pick<ServiceColumns, "image" | "inputs" | "service">;

/** An `expected` answer to decode, and its case's position for errors. */
type Utf16TagsToDecode = {
  /**
   * The case's position in its file.
   *
   * @example 0
   */
  caseIndex: number;

  /**
   * The answer, or a part of it.
   *
   * @example `{ "$utf16": [55296] }`
   */
  value: EncodedValue;
};

/** The function name of the case file that checks the codec itself. */
export const CODEC_FUNCTION = "codec";

/** Every tier, in table order. */
export const TIERS = [0, 1, 2, 3, 4] as const;

/** Compares letters alone: `"beta"` and `"Béta"` sort together. */
const BASE_SENSITIVITY: Intl.CollatorOptions = { sensitivity: "base" };

/** The `kind`s an outcome may have. */
const OUTCOME_KINDS: ReadonlySet<unknown> = new Set(["error", "n/a", "value"]);

/** `TIERS` as a set, for narrowing. */
const TIER_SET: ReadonlySet<unknown> = new Set(TIERS);

/**
 * Merge every adapter's columns into one result per case file.
 *
 * - A case file with `expected` answers gains a tier-0 `safe-fns (planned)`
 *   column.
 *
 * @returns one result per case file, in case-file order.
 * @throws Error when a column's outcome count doesn't match its cases.
 */
export function buildResults({
  caseFiles,
  serviceColumns,
}: BuildResultsInput): FunctionResult[] {
  return caseFiles.map((caseFile) => {
    const columns = serviceColumns.flatMap(
      ({ columns: adapterColumns, image, inputs, service }) =>
        adapterColumns
          .filter((column) => column.function === caseFile.function)
          .map((column) => toResultColumn({ column, image, inputs, service }))
    );

    const plannedColumn = toPlannedColumn(caseFile);

    for (const column of columns) {
      if (column.outcomes.length !== caseFile.cases.length) {
        throw new Error(
          `${column.name} \`${column.call}\` returned ${column.outcomes.length} outcomes for ${caseFile.cases.length} ${caseFile.function} cases`
        );
      }
    }

    return {
      cases: caseFile.cases.map(({ args }) => args),
      columns: [...(plannedColumn ? [plannedColumn] : []), ...columns].sort(
        compareColumns
      ),
      function: caseFile.function,
    };
  });
}

/**
 * Check that every column of the codec result returned its input unchanged.
 *
 * - `n/a` is allowed: a language may lack a type, but must never alter one.
 *
 * - A `$js` input names a value rather than spelling it, so it can't
 *   round-trip; only the adapters that can't build it are checked (`n/a`).
 *
 * - `JSON.stringify` can't throw here: it only sees encoded values and
 *   outcomes, which hold no bigint, cycle, or `toJSON`.
 *
 * @returns one message per mismatch; empty when every adapter round-trips.
 */
export function findCodecMismatches(result: FunctionResult): string[] {
  return result.columns.flatMap((column) =>
    column.outcomes.flatMap((outcome, index) => {
      const input = result.cases[index]?.[0] ?? null;
      const expected = JSON.stringify(input, sortKeysReplacer);

      if (
        isJsTag(input) ||
        outcome.kind === "n/a" ||
        (outcome.kind === "value" &&
          JSON.stringify(outcome.value, sortKeysReplacer) === expected)
      ) {
        return [];
      }

      return [
        `${column.name} ${column.version} case ${index + 1}: expected ${expected}, got ${JSON.stringify(outcome, sortKeysReplacer)}`,
      ];
    })
  );
}

/**
 * Keep the committed columns of every service a narrowed run skipped.
 *
 * - The planned column always comes from the current case file.
 *
 * @returns the merged result, columns sorted as `buildResults` sorts them.
 * @throws Error when the cases changed since the committed results, since the
 *   kept columns would no longer line up with them.
 */
export function mergeWithPrevious({
  next,
  previous,
  servicesRun,
}: MergeInput): FunctionResult {
  if (previous === undefined) {
    return next;
  }

  if (stringifyStable(previous.cases) !== stringifyStable(next.cases)) {
    throw new Error(
      `${next.function}: the cases changed since the committed results; rerun every profile`
    );
  }

  const keptColumns = previous.columns.filter(
    ({ service, tier }) => tier !== 0 && !servicesRun.has(service)
  );

  return {
    ...next,
    columns: [...next.columns, ...keptColumns].sort(compareColumns),
  };
}

/**
 * Narrow an adapter's stdout, already parsed as JSON.
 *
 * @returns the adapter's columns.
 * @throws Error naming the first field that doesn't fit.
 */
export function parseAdapterOutput(json: unknown): AdapterColumn[] {
  const columns = isRecord(json) ? json.columns : undefined;

  if (!Array.isArray(columns)) {
    throw new Error("adapter output has no `columns` array");
  }

  return columns.map((column: unknown, index) => {
    if (!isRecord(column) || typeof column.function !== "string") {
      throw new Error(`column ${index} lacks a \`function\` string`);
    }

    return {
      ...parseColumnCore({ column, index }),
      function: column.function,
    };
  });
}

/**
 * Narrow a case file, already parsed as JSON.
 *
 * @returns the case file.
 * @throws Error naming the first field that doesn't fit.
 */
export function parseCaseFile(json: unknown): CaseFile {
  if (
    !isRecord(json) ||
    typeof json.function !== "string" ||
    !Array.isArray(json.cases)
  ) {
    throw new Error("a case file needs a `function` string and `cases` array");
  }

  return {
    cases: json.cases.map((entry: unknown, index) => {
      if (
        !isRecord(entry) ||
        !Array.isArray(entry.args) ||
        !entry.args.every((arg) => isEncodedValue(arg))
      ) {
        throw new Error(`case ${index} needs an \`args\` array of JSON`);
      }

      if (entry.expected !== undefined && !isEncodedValue(entry.expected)) {
        throw new Error(`case ${index} has a non-JSON \`expected\``);
      }

      return entry.expected === undefined
        ? { args: entry.args }
        : {
            args: entry.args,
            expected: decodeUtf16Tags({
              caseIndex: index,
              value: entry.expected,
            }),
          };
    }),
    function: json.function,
  };
}

/**
 * Narrow a committed `research/results/<function>.json`, already parsed.
 *
 * @returns the result.
 * @throws Error naming the first field that doesn't fit.
 */
export function parseFunctionResult(json: unknown): FunctionResult {
  if (
    !isRecord(json) ||
    typeof json.function !== "string" ||
    !Array.isArray(json.cases) ||
    !Array.isArray(json.columns)
  ) {
    throw new Error("a result needs `function`, `cases`, and `columns`");
  }

  const cases = json.cases.map((args: unknown, index) => {
    if (!Array.isArray(args) || !args.every((arg) => isEncodedValue(arg))) {
      throw new Error(`result case ${index} isn't an array of JSON`);
    }

    return args;
  });

  const columns = json.columns.map((column: unknown, index) => {
    if (
      !isRecord(column) ||
      typeof column.image !== "string" ||
      typeof column.service !== "string"
    ) {
      throw new Error(`result column ${index} lacks \`image\` or \`service\``);
    }

    if (column.inputs !== undefined && typeof column.inputs !== "string") {
      throw new Error(`result column ${index} has a non-string \`inputs\``);
    }

    return {
      ...parseColumnCore({ column, index }),
      image: column.image,
      ...(column.inputs === undefined ? {} : { inputs: column.inputs }),
      service: column.service,
    };
  });

  return { cases, columns, function: json.function };
}

/**
 * Serialize a value as JSON with every object's keys sorted, two-space
 * indented, with a trailing newline.
 *
 * - Sorted keys keep a rerun byte-identical whatever order an adapter or
 *   language emitted them in.
 *
 * - Only ever given results and encoded values, which hold nothing
 *   `JSON.stringify` throws on.
 *
 * @returns the JSON text.
 */
export function stringifyStable(value: unknown): string {
  return `${JSON.stringify(value, sortKeysReplacer, 2)}\n`;
}

/**
 * Order columns by tier, then name, then call, ignoring case and accents.
 *
 * - Ties then break on case and accents, so the order is total and a rerun
 *   stays byte-identical.
 */
function compareColumns(left: ResultColumn, right: ResultColumn): number {
  return (
    left.tier - right.tier ||
    left.name.localeCompare(right.name, "en-US", BASE_SENSITIVITY) ||
    left.call.localeCompare(right.call, "en-US", BASE_SENSITIVITY) ||
    left.name.localeCompare(right.name, "en-US") ||
    left.call.localeCompare(right.call, "en-US")
  );
}

/**
 * Decode every `{ "$utf16": [codeUnit, …] }` tag in an `expected` answer.
 *
 * - It's the one way to plan a lone surrogate: every adapter reads the case
 *   file itself, and Rust's JSON parser rejects `"\ud800"`.
 *
 * - Adapters never read `expected`, so the tag needs no twin in their codecs.
 *
 * - A `$object` escape's keys are data, so a `$utf16` key inside one stays a
 *   key; only its values are decoded.
 *
 * @returns the answer, with each tag replaced by its string.
 * @throws Error when a tag's payload isn't an array of UTF-16 code units.
 */
function decodeUtf16Tags({
  caseIndex,
  value,
}: Utf16TagsToDecode): EncodedValue {
  if (Array.isArray(value)) {
    return value.map((item) => decodeUtf16Tags({ caseIndex, value: item }));
  }

  if (!isRecord(value)) {
    return value;
  }

  const decodeValues = (
    entries: Record<string, EncodedValue>
  ): Record<string, EncodedValue> =>
    Object.fromEntries(
      Object.entries(entries).map(([key, item]) => [
        key,
        decodeUtf16Tags({ caseIndex, value: item }),
      ])
    );

  const isSingleKey = Object.keys(value).length === 1;

  if (isSingleKey && isRecord(value.$object)) {
    return { $object: decodeValues(value.$object) };
  }

  if (isSingleKey && "$utf16" in value) {
    const codeUnits = value.$utf16;

    if (
      !Array.isArray(codeUnits) ||
      !codeUnits.every(
        (codeUnit): codeUnit is number =>
          typeof codeUnit === "number" &&
          Number.isInteger(codeUnit) &&
          codeUnit >= 0 &&
          codeUnit <= 0xff_ff
      )
    ) {
      throw new Error(
        `case ${caseIndex} has a \`$utf16\` tag that isn't an array of UTF-16 code units`
      );
    }

    return codeUnits.map((codeUnit) => String.fromCharCode(codeUnit)).join("");
  }

  return decodeValues(value);
}

/** Check that a value is JSON the portable format can hold. */
function isEncodedValue(value: unknown): value is EncodedValue {
  if (Array.isArray(value)) {
    return value.every((item) => isEncodedValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isEncodedValue(item));
  }

  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/** Check for a `{ "$js": name }` tag. */
function isJsTag(value: EncodedValue): boolean {
  return isRecord(value) && Object.keys(value).length === 1 && "$js" in value;
}

/** Check that a value is one of `TIERS`. */
function isTier(value: unknown): value is Tier {
  return TIER_SET.has(value);
}

/** Narrow the fields every column shares. */
function parseColumnCore({ column, index }: ColumnToParse): ColumnCore {
  if (
    !isRecord(column) ||
    typeof column.call !== "string" ||
    typeof column.locale !== "string" ||
    typeof column.name !== "string" ||
    typeof column.version !== "string"
  ) {
    throw new Error(`column ${index} lacks a string field`);
  }

  if (!isTier(column.tier) || !Array.isArray(column.outcomes)) {
    throw new Error(`column ${index} has a bad tier or outcomes`);
  }

  if (column.source !== undefined && typeof column.source !== "string") {
    throw new Error(`column ${index} has a non-string source`);
  }

  return {
    call: column.call,
    locale: column.locale,
    name: column.name,
    outcomes: column.outcomes.map((outcome: unknown) => parseOutcome(outcome)),
    ...(column.source === undefined ? {} : { source: column.source }),
    tier: column.tier,
    version: column.version,
  };
}

/** Narrow one outcome. */
function parseOutcome(outcome: unknown): Outcome {
  if (!isRecord(outcome) || !OUTCOME_KINDS.has(outcome.kind)) {
    throw new Error("an outcome needs a `kind` of value, error, or n/a");
  }

  if (outcome.kind === "error" && typeof outcome.error === "string") {
    return { error: outcome.error, kind: "error" };
  }

  if (outcome.kind === "value" && isEncodedValue(outcome.value)) {
    return { kind: "value", value: outcome.value };
  }

  if (outcome.kind === "n/a") {
    return { kind: "n/a" };
  }

  throw new Error(`a ${String(outcome.kind)} outcome is missing its payload`);
}

/** A `JSON.stringify` replacer that sorts every object's keys. */
function sortKeysReplacer(_key: string, value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, value[key]])
  );
}

/** Build the tier-0 column from a case file's `expected` answers. */
function toPlannedColumn(caseFile: CaseFile): ResultColumn | undefined {
  if (caseFile.cases.every(({ expected }) => expected === undefined)) {
    return undefined;
  }

  return {
    call: caseFile.function,
    image: "-",
    locale: "-",
    name: "safe-fns (planned)",
    outcomes: caseFile.cases.map(({ expected }) =>
      expected === undefined
        ? { kind: "n/a" }
        : { kind: "value", value: expected }
    ),
    service: "-",
    tier: 0,
    version: "-",
  };
}

/** Attach the service, image, and inputs an adapter column ran with. */
function toResultColumn({
  column,
  image,
  inputs,
  service,
}: ColumnWithOrigin): ResultColumn {
  return {
    call: column.call,
    image,
    inputs,
    locale: column.locale,
    name: column.name,
    outcomes: column.outcomes,
    service,
    ...(column.source === undefined ? {} : { source: column.source }),
    tier: column.tier,
    version: column.version,
  };
}
