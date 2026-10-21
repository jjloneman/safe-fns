import lodash from "lodash";

import type { Tool } from "./tool.mts";

import { markReferences, packageVersion } from "./tool.mts";

/** lodash's checks and coercions. */
export const LODASH: Tool = {
  functions: {
    isPlainObject: [
      {
        call: "_.isPlainObject(value)",
        run: ([value]) => lodash.isPlainObject(value),
      },
    ],
    isSafeEmpty: [
      { call: "_.isEmpty(value)", run: ([value]) => lodash.isEmpty(value) },
    ],
    safeObjectHasOwn: [
      {
        call: "_.has(object, key)",
        run: ([object, key]) => lodash.has(object, key as string),
      },
    ],
    safeParseInt: [
      {
        call: "_.toInteger(value)",
        run: ([value]) => lodash.toInteger(value),
      },
      {
        call: "_.toSafeInteger(value)",
        run: ([value]) => lodash.toSafeInteger(value),
      },
    ],
    safeParseNumber: [
      { call: "_.toNumber(value)", run: ([value]) => lodash.toNumber(value) },
    ],
    safeParseString: [
      { call: "_.toString(value)", run: ([value]) => lodash.toString(value) },
    ],
    safeStructuredClone: [
      {
        call: "_.cloneDeep(value)",
        run: ([value]) => markReferences(lodash.cloneDeep(value)),
      },
    ],
  },
  name: "lodash",
  tier: 1,
  version: packageVersion("lodash"),
};
