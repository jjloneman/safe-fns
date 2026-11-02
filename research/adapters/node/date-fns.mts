import { formatISO, milliseconds, parseISO } from "date-fns";

import type { Tool } from "./tool.mts";

import { hasNoOptions, isString, packageVersion } from "./tool.mts";

/** date-fns, whose `formatISO` writes the runtime's local offset. */
export const DATE_FNS: Tool = {
  functions: {
    safeDateToIsoString: [
      {
        call: "formatISO(value)",
        run: ([value]) => formatISO(value as Date | number),
      },
    ],
    safeParseDate: [
      {
        accepts: isString,
        call: "parseISO(value).toISOString()",
        run: ([value]) => parseISO(value as string).toISOString(),
      },
    ],
    toMs: [
      {
        accepts: hasNoOptions,
        call: "milliseconds(value)",
        run: ([value]) =>
          milliseconds(value as Parameters<typeof milliseconds>[0]),
      },
    ],
  },
  name: "date-fns",
  tier: 1,
  version: packageVersion("date-fns"),
};
