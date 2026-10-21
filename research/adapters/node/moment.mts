import moment from "moment";

import type { Tool } from "./tool.mts";

import { isString } from "./tool.mts";

// moment warns on stderr when it falls back to `new Date`; keep runs quiet.
moment.suppressDeprecationWarnings = true;

/** Moment.js, in maintenance mode but still widely installed. */
export const MOMENT: Tool = {
  functions: {
    safeDateToIsoString: [
      {
        // `moment(undefined)` is the current time, which no rerun reproduces.
        accepts: ([value]) => value !== undefined,
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
