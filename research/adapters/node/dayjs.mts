import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";

import type { Tool } from "./tool.mts";

import { hasNoOptions, isString, packageVersion } from "./tool.mts";

/*
 * Day.js plugins extend the shared instance on import, so every Day.js probe
 * sees them.
 *
 * - `duration` only adds `dayjs.duration`, which no other probe calls, so the
 *   date columns don't change; check that holds before extending another.
 */
dayjs.extend(duration);

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
    toMs: [
      {
        accepts: hasNoOptions,
        call: "dayjs.duration(value).asMilliseconds()",
        run: ([value]) =>
          dayjs
            .duration(value as Parameters<typeof dayjs.duration>[0])
            .asMilliseconds(),
      },
    ],
  },
  name: "Day.js",
  tier: 1,
  version: packageVersion("dayjs"),
};
