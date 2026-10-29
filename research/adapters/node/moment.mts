import moment from "moment";

import type { Tool } from "./tool.mts";

import { isString } from "./tool.mts";

// moment warns on stderr when it falls back to `new Date`; keep runs quiet.
moment.suppressDeprecationWarnings = true;

/**
 * Whether Moment reads a value as the current time, which no rerun reproduces:
 * an empty array, or an object with no own properties from any realm.
 *
 * - A value whose inspection throws (a revoked proxy) is left for the probe
 *   itself to run, so its error lands in its own cell.
 */
function isReadAsNow(value: unknown): boolean {
  try {
    return Array.isArray(value)
      ? value.length === 0
      : Object.prototype.toString.call(value) === "[object Object]" &&
          Object.getOwnPropertyNames(value).length === 0;
  } catch {
    return false;
  }
}

/** Moment.js, in maintenance mode but still widely installed. */
export const MOMENT: Tool = {
  functions: {
    safeDateToIsoString: [
      {
        // `moment(undefined)` is the current time too.
        accepts: ([value]) => value !== undefined && !isReadAsNow(value),
        call: "moment(value).toISOString()",
        run: ([value]) => moment(value as Date | number).toISOString(),
      },
    ],
    safeParseDate: [
      {
        accepts: isString,
        call: "moment(value).toISOString()",
        run: ([value]) => moment(value as string).toISOString(),
      },
      {
        accepts: isString,
        call: "moment(value, moment.ISO_8601, true).toISOString()",
        run: ([value]) =>
          moment(value as string, moment.ISO_8601, true).toISOString(),
      },
    ],
  },
  name: "Moment.js",
  tier: 1,
  version: moment.version,
};
