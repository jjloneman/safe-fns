import dayjs from "dayjs";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** Day.js, whose `toISOString` wraps the native one. */
export const DAYJS: Tool = {
  functions: {
    safeDateToIsoString: [
      {
        // `dayjs(undefined)` is the current time, which no rerun reproduces.
        accepts: ([value]) => value !== undefined,
        call: "dayjs(value).toISOString()",
        run: ([value]) => dayjs(value as Date | number).toISOString(),
      },
    ],
    safeParseDate: [
      {
        accepts: isString,
        call: "dayjs(value).toISOString()",
        run: ([value]) => dayjs(value as string).toISOString(),
      },
    ],
  },
  name: "Day.js",
  tier: 1,
  version: packageVersion("dayjs"),
};
