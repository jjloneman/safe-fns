import { isEmpty, isEqual, isObject, toFloat, toInt } from "radash";

import type { Tool } from "./tool.mts";

import { isPair, packageVersion } from "./tool.mts";

/** radash, whose `toInt` and `toFloat` return a fallback instead of `NaN`. */
export const RADASH: Tool = {
  functions: {
    isDeepEqual: [
      {
        accepts: isPair,
        call: "isEqual(a, b)",
        run: ([a, b]) => isEqual(a, b),
      },
    ],
    // radash's `isObject` checks `constructor === Object`: a plain-object test.
    isPlainObject: [
      { call: "isObject(value)", run: ([value]) => isObject(value) },
    ],
    isSafeEmpty: [{ call: "isEmpty(value)", run: ([value]) => isEmpty(value) }],
    safeParseInt: [{ call: "toInt(value)", run: ([value]) => toInt(value) }],
    safeParseNumber: [
      { call: "toFloat(value)", run: ([value]) => toFloat(value) },
    ],
  },
  name: "radash",
  tier: 1,
  version: packageVersion("radash"),
};
