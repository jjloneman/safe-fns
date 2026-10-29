import lodash from "lodash";

import type { Tool } from "./tool.mts";

import {
  hasNoOptions,
  hasOnlyOptions,
  markReferences,
  packageVersion,
} from "./tool.mts";

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
    lowerFirst: [
      {
        accepts: hasNoOptions,
        call: "_.lowerFirst(value)",
        run: ([value]) => lodash.lowerFirst(value),
      },
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
    toBasicAscii: [
      { call: "_.deburr(value)", run: ([value]) => lodash.deburr(value) },
    ],
    trimBlank: [
      { call: "_.trim(value)", run: ([value]) => lodash.trim(value) },
    ],
    upperFirst: [
      {
        accepts: hasNoOptions,
        call: "_.upperFirst(value)",
        run: ([value]) => lodash.upperFirst(value),
      },
      {
        accepts: (args) =>
          hasNoOptions(args) ||
          (hasOnlyOptions(args, ["lowerRest"]) &&
            (args[1] as Record<string, unknown>).lowerRest === true),
        call: "_.capitalize(value)",
        run: ([value]) => lodash.capitalize(value),
      },
    ],
  },
  name: "lodash",
  tier: 1,
  version: packageVersion("lodash"),
};
