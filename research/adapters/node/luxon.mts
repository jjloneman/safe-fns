import { DateTime } from "luxon";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** luxon, whose `DateTime` reports an invalid date by returning `null`. */
export const LUXON: Tool = {
  functions: {
    safeDateToIsoString: [
      {
        accepts: ([value]) => value instanceof Date,
        call: 'DateTime.fromJSDate(value, { zone: "utc" }).toISO()',
        run: ([value]) =>
          DateTime.fromJSDate(value as Date, { zone: "utc" }).toISO(),
      },
      {
        accepts: ([value]) => typeof value === "number",
        call: 'DateTime.fromMillis(value, { zone: "utc" }).toISO()',
        run: ([value]) =>
          DateTime.fromMillis(value as number, { zone: "utc" }).toISO(),
      },
    ],
    safeParseDate: [
      {
        accepts: isString,
        call: 'DateTime.fromISO(value, { zone: "utc" }).toISO()',
        run: ([value]) =>
          DateTime.fromISO(value as string, { zone: "utc" }).toISO(),
      },
    ],
  },
  name: "luxon",
  tier: 1,
  version: packageVersion("luxon"),
};
