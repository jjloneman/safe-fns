import {
  isEmpty as esToolkitIsEmpty,
  toInteger as esToolkitToInteger,
  toNumber as esToolkitToNumber,
  toString as esToolkitToString,
} from "es-toolkit/compat";
import { isPlainObject as esToolkitIsPlainObject } from "es-toolkit/predicate";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** es-toolkit's own predicate, and its lodash-compatible layer. */
export const ES_TOOLKIT: Tool = {
  functions: {
    isPlainObject: [
      {
        call: "isPlainObject(value)",
        run: ([value]) => esToolkitIsPlainObject(value),
      },
    ],
    isSafeEmpty: [
      {
        call: "compat.isEmpty(value)",
        run: ([value]) => esToolkitIsEmpty(value),
      },
    ],
    safeParseInteger: [
      {
        call: "compat.toInteger(value)",
        run: ([value]) => esToolkitToInteger(value),
      },
    ],
    safeParseNumber: [
      {
        call: "compat.toNumber(value)",
        run: ([value]) => esToolkitToNumber(value),
      },
    ],
    safeParseString: [
      {
        call: "compat.toString(value)",
        run: ([value]) => esToolkitToString(value),
      },
    ],
  },
  name: "es-toolkit",
  tier: 1,
  version: packageVersion("es-toolkit"),
};
