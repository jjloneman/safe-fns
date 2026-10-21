import { parse } from "csv-parse/sync";

import type { Probe, Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** Read the first cell of a CSV document, typed `unknown`. */
function parseCsvCell(text: string): unknown {
  const records: unknown = parse(text, { cast: true });

  return Array.isArray(records) && Array.isArray(records[0])
    ? (records[0] as unknown[])[0]
    : undefined;
}

/** A case as the first cell of a one-line CSV document, with casting on. */
const CSV_CELL: Probe = {
  accepts: isString,
  call: "parse(value, { cast: true })[0]?.[0]",
  run: ([value]) => parseCsvCell(value as string),
};

/** CSV, which has no types; csv-parse's `cast` is the common convention. */
export const CSV: Tool = {
  functions: {
    safeParseBoolean: [CSV_CELL],
    safeParseInt: [CSV_CELL],
    safeParseNumber: [CSV_CELL],
  },
  name: "CSV",
  tier: 3,
  version: `csv-parse ${packageVersion("csv-parse")}`,
};
