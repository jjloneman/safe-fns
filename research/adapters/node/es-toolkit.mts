import {
  isEmpty as esToolkitIsEmpty,
  toInteger as esToolkitToInteger,
  toNumber as esToolkitToNumber,
  toString as esToolkitToString,
} from "es-toolkit/compat";
import { cloneDeep as esToolkitCloneDeep } from "es-toolkit/object";
import { isPlainObject as esToolkitIsPlainObject } from "es-toolkit/predicate";
import {
  capitalize as esToolkitCapitalize,
  deburr as esToolkitDeburr,
  lowerFirst as esToolkitLowerFirst,
  trim as esToolkitTrim,
  upperFirst as esToolkitUpperFirst,
} from "es-toolkit/string";

import type { Tool } from "./tool.mts";

import {
  hasNoOptions,
  hasOnlyOptions,
  markReferences,
  packageVersion,
} from "./tool.mts";

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
    lowerFirst: [
      {
        accepts: hasNoOptions,
        call: "lowerFirst(value)",
        run: ([value]) => esToolkitLowerFirst(value as string),
      },
    ],
    safeParseInt: [
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
    safeStructuredClone: [
      {
        call: "cloneDeep(value)",
        run: ([value]) => markReferences(esToolkitCloneDeep(value)),
      },
    ],
    toBasicAscii: [
      {
        call: "deburr(value)",
        run: ([value]) => esToolkitDeburr(value as string),
      },
    ],
    trimBlank: [
      { call: "trim(value)", run: ([value]) => esToolkitTrim(value as string) },
    ],
    upperFirst: [
      {
        accepts: hasNoOptions,
        call: "upperFirst(value)",
        run: ([value]) => esToolkitUpperFirst(value as string),
      },
      {
        accepts: (args) =>
          hasNoOptions(args) ||
          (hasOnlyOptions(args, ["lowerRest"]) &&
            (args[1] as Record<string, unknown>).lowerRest === true),
        call: "capitalize(value)",
        run: ([value]) => esToolkitCapitalize(value as string),
      },
    ],
  },
  name: "es-toolkit",
  tier: 1,
  version: packageVersion("es-toolkit"),
};
