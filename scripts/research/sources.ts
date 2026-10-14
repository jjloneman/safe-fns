/*
 * Builds docs-only columns from the outcomes cached in `research/sources/`.
 *
 * - A tool that can't run in a container (Excel, Google Sheets) gets a
 *   `<tool>.md` excerpt and a `<tool>.json` of the outcomes it settles; the
 *   `sources` adapter turns the JSON into columns marked with their source.
 *
 * - Outcomes are keyed by their case's arguments, not its position, so adding
 *   a case leaves it `n/a` instead of shifting every answer after it.
 */
import type { AdapterColumn, CaseFile } from "./results.ts";

import { isRecord } from "./codec.ts";
import { parseAdapterOutput, stringifyStable } from "./results.ts";

/** One case file, and every cached source to answer it from. */
export type SourceColumnsInput = {
  /**
   * The case file to build columns for.
   *
   * @example `{ cases: [{ args: ["1e3"] }], function: "safeParseNumber" }`
   */
  caseFile: CaseFile;

  /**
   * Each cached source's parsed JSON, and the excerpt it was transcribed
   * from.
   *
   * @example `[{ json: { columns: [] }, source: "research/sources/excel.md" }]`
   */
  sourceFiles: readonly SourceFile[];
};

/** One `research/sources/<tool>.json`, and the excerpt it transcribes. */
export type SourceFile = {
  /**
   * The file's parsed JSON.
   *
   * @example `{ columns: [{ call: "VALUE(value)", cases: [], … }] }`
   */
  json: unknown;

  /**
   * The excerpt the outcomes come from, relative to the repo root.
   *
   * @example "research/sources/excel.md"
   */
  source: string;
};

/** Every function a case file exists for, and the cached sources. */
export type SourceFunctionsInput = {
  /**
   * The function every case file in `research/cases/` names.
   *
   * @example `["safeParseBoolean", "safeParseNumber"]`
   */
  functionNames: readonly string[];
} & Pick<SourceColumnsInput, "sourceFiles">;

/** One cached column, with its outcomes still keyed by their arguments. */
type CachedColumn = {
  /**
   * The cases the source settles, each with its arguments and outcome.
   *
   * @example `[{ args: ["1e3"], outcome: { kind: "value", value: 1000 } }]`
   */
  cases: CachedOutcome[];

  /**
   * The function the column answers for, narrowed later.
   *
   * @example "safeParseNumber"
   */
  function: unknown;
} & Record<string, unknown>;

/** One settled case: its arguments, and the outcome the source gives. */
type CachedOutcome = {
  /**
   * The case's arguments, in the portable format.
   *
   * @example `["1e3"]`
   */
  args: unknown[];

  /**
   * The outcome, narrowed later by the shared parser.
   *
   * @example `{ kind: "value", value: 1000 }`
   */
  outcome: unknown;
};

/**
 * Check that every cached column names a function some case file has.
 *
 * - `toSourceColumns` only sees the case files a run covers, so a misspelled
 *   function would otherwise just produce no column.
 *
 * @throws Error naming the source and the unknown function.
 */
export function checkSourceFunctions({
  functionNames,
  sourceFiles,
}: SourceFunctionsInput): void {
  const knownNames = new Set<unknown>(functionNames);

  for (const { json, source } of sourceFiles) {
    const unknownColumn = sourceColumns({ json, source }).find(
      (column) => !knownNames.has(column.function)
    );

    if (unknownColumn !== undefined) {
      throw new Error(
        `${source} names a function no case file has: ${String(unknownColumn.function)}`
      );
    }
  }
}

/**
 * Build the docs-only columns a case file gets from the cached sources.
 *
 * - A case the source doesn't settle is `n/a`.
 *
 * @returns one column per cached column for the case file's function.
 * @throws Error when a source file is malformed, settles a case twice, or
 *   settles a case the case file no longer has.
 */
export function toSourceColumns({
  caseFile,
  sourceFiles,
}: SourceColumnsInput): AdapterColumn[] {
  const caseKeys = new Set(
    caseFile.cases.map(({ args }) => stringifyStable(args))
  );

  const columns = sourceFiles.flatMap(({ json, source }) =>
    sourceColumns({ json, source })
      .filter((column) => column.function === caseFile.function)
      .map(({ cases, ...column }) => {
        const outcomesByArgs = new Map(
          cases.map(({ args, outcome }) => [stringifyStable(args), outcome])
        );

        if (outcomesByArgs.size !== cases.length) {
          throw new Error(
            `${source} settles a ${caseFile.function} case more than once`
          );
        }

        const staleKey = [...outcomesByArgs.keys()].find(
          (key) => !caseKeys.has(key)
        );

        if (staleKey !== undefined) {
          throw new Error(
            `${source} settles a ${caseFile.function} case that no longer exists: ${staleKey}`
          );
        }

        return {
          ...column,
          outcomes: caseFile.cases.map(
            ({ args }) =>
              outcomesByArgs.get(stringifyStable(args)) ?? { kind: "n/a" }
          ),
          source,
        };
      })
  );

  // The shared parser narrows each outcome, as it does any adapter's output.
  return parseAdapterOutput({ columns });
}

/**
 * Narrow one source file's columns, leaving their outcomes to the shared
 * parser.
 *
 * @returns each column with its cases keyed for lookup.
 * @throws Error when the file lacks a `columns` array, or a case lacks `args`.
 */
function sourceColumns({ json, source }: SourceFile): CachedColumn[] {
  const columns = isRecord(json) ? json.columns : undefined;

  if (!Array.isArray(columns)) {
    throw new Error(`${source}'s JSON has no \`columns\` array`);
  }

  return columns.map((column: unknown) => {
    if (!isRecord(column) || !Array.isArray(column.cases)) {
      throw new Error(`${source} has a column without a \`cases\` array`);
    }

    return {
      ...column,
      cases: column.cases.map((entry: unknown) => {
        if (!isRecord(entry) || !Array.isArray(entry.args)) {
          throw new Error(`${source} has a case without an \`args\` array`);
        }

        return { args: entry.args, outcome: entry.outcome };
      }),
      function: column.function,
    };
  });
}
