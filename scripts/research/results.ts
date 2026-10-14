import type { EncodedValue } from "./codec.ts";

import { isRecord } from "./codec.ts";

/**
 * One adapter's answer for one function, before the runner adds its service
 * and image.
 */
export type AdapterColumn = {
  /**
   * The function the column answers for, as named in its case file.
   *
   * @example "safeParseBoolean"
   */
  function: string;
} & Omit<ResultColumn, "image" | "service">;

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
   * @example true
   */
  expected?: EncodedValue;
};

/** The parsed contents of `research/cases/<function>.json`. */
export type CaseFile = {
  /** The cases, in the order the tables list them. */
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
  /** Each case's arguments, in case-file order. */
  cases: CaseEntry["args"][];

  /** The columns, ordered by tier, then name, then call. */
  columns: ResultColumn[];
} & Pick<CaseFile, "function">;

/** What one call did with one case. */
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
   * The expression each case ran through.
   *
   * @example "z.stringbool().parse(value)"
   */
  call: string;

  /**
   * The pinned image the tool ran in, or `-` for the planned column.
   *
   * @example `"node:26.9.0-bookworm-slim@sha256:…"`
   */
  image: string;

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

  /** One outcome per case, in case-file order. */
  outcomes: Outcome[];

  /**
   * The Compose service that produced the column, or `-` for the planned
   * column; a narrowed run replaces only the columns of the services it ran.
   *
   * @example "node"
   */
  service: string;

  /** The column's tier, which orders the tables; 0 is safe-fns itself. */
  tier: Tier;

  /**
   * The tool's version.
   *
   * @example "4.6.5"
   */
  version: string;
};

/** The columns one Compose service printed, as the runner collected them. */
export type ServiceColumns = {
  /** The columns the adapter printed. */
  columns: AdapterColumn[];

  /**
   * The pinned image the adapter ran in.
   *
   * @example `"python:3.14.7-slim-bookworm@sha256:…"`
   */
  image: string;

  /**
   * The Compose service name.
   *
   * @example "sqlite"
   */
  service: string;
};

/** A table tier; 0 is safe-fns' own planned column. */
export type Tier = (typeof TIERS)[number];

/** The fields every column shares, in adapter output and in results alike. */
type ColumnCore = Omit<ResultColumn, "image" | "service">;

/** The function name of the case file that checks the codec itself. */
export const CODEC_FUNCTION = "codec";

/** Every tier, in table order. */
export const TIERS = [0, 1, 2, 3, 4] as const;

const OUTCOME_KINDS: ReadonlySet<unknown> = new Set(["error", "n/a", "value"]);

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
}: {
  caseFiles: readonly CaseFile[];
  serviceColumns: readonly ServiceColumns[];
}): FunctionResult[] {
  return caseFiles.map((caseFile) => {
    const columns = serviceColumns.flatMap(
      ({ columns: adapterColumns, image, service }) =>
        adapterColumns
          .filter((column) => column.function === caseFile.function)
          .map((column) => toResultColumn({ column, image, service }))
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
}: {
  next: FunctionResult;
  previous: FunctionResult | undefined;
  servicesRun: ReadonlySet<string>;
}): FunctionResult {
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
        : { args: entry.args, expected: entry.expected };
    }),
    function: json.function,
  };
}

/**
 * Narrow a committed `research/results/<function>.json`, already parsed as
 * JSON.
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

    return {
      ...parseColumnCore({ column, index }),
      image: column.image,
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
 * @returns the JSON text.
 */
export function stringifyStable(value: unknown): string {
  return `${JSON.stringify(value, sortKeysReplacer, 2)}\n`;
}

/** Order columns by tier, then name, then call. */
function compareColumns(left: ResultColumn, right: ResultColumn): number {
  return (
    left.tier - right.tier ||
    left.name.localeCompare(right.name, "en") ||
    left.call.localeCompare(right.call, "en")
  );
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
function parseColumnCore({
  column,
  index,
}: {
  column: unknown;
  index: number;
}): ColumnCore {
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

  return {
    call: column.call,
    locale: column.locale,
    name: column.name,
    outcomes: column.outcomes.map((outcome: unknown) => parseOutcome(outcome)),
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

/** Attach the service and image an adapter column ran in. */
function toResultColumn({
  column,
  image,
  service,
}: { column: AdapterColumn } & Pick<
  ServiceColumns,
  "image" | "service"
>): ResultColumn {
  return {
    call: column.call,
    image,
    locale: column.locale,
    name: column.name,
    outcomes: column.outcomes,
    service,
    tier: column.tier,
    version: column.version,
  };
}
