import { keyBy as esToolkitKeyBy } from "es-toolkit/array";
import {
  isEmpty as esToolkitIsEmpty,
  toInteger as esToolkitToInteger,
  toNumber as esToolkitToNumber,
  toString as esToolkitToString,
} from "es-toolkit/compat";
import { range as esToolkitRange } from "es-toolkit/math";
import {
  cloneDeep as esToolkitCloneDeep,
  toMerged as esToolkitToMerged,
} from "es-toolkit/object";
import {
  isEqual as esToolkitIsEqual,
  isPlainObject as esToolkitIsPlainObject,
} from "es-toolkit/predicate";
import {
  capitalize as esToolkitCapitalize,
  deburr as esToolkitDeburr,
  lowerFirst as esToolkitLowerFirst,
  trim as esToolkitTrim,
  upperFirst as esToolkitUpperFirst,
} from "es-toolkit/string";

import type { Tool } from "./tool.mts";

import {
  callWithRange,
  hasNoOptions,
  hasOnlyOptions,
  isPair,
  isRangeCase,
  keyGetter,
  markClone,
  markKeyed,
  markReferences,
  packageVersion,
} from "./tool.mts";

/** es-toolkit's own predicate, and its lodash-compatible layer. */
export const ES_TOOLKIT: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "cloneDeep(value)",
        run: ([value]) =>
          markClone({ clone: esToolkitCloneDeep(value), source: value }),
      },
    ],
    deepMerge: [
      {
        accepts: isPair,
        call: "toMerged(defaults, overrides)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: esToolkitToMerged(defaults as object, overrides as object),
            source: [defaults, overrides],
          }),
      },
    ],
    isDeepEqual: [
      {
        accepts: isPair,
        call: "isEqual(a, b)",
        run: ([a, b]) => esToolkitIsEqual(a, b),
      },
    ],
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
    keyBy: [
      {
        accepts: isPair,
        call: "keyBy(items, getKey)",
        run: ([items, key]) =>
          markKeyed(
            esToolkitKeyBy(
              items as readonly unknown[],
              keyGetter(key) as (item: unknown) => PropertyKey
            )
          ),
      },
    ],
    lowerFirst: [
      {
        accepts: hasNoOptions,
        call: "lowerFirst(value)",
        run: ([value]) => esToolkitLowerFirst(value as string),
      },
    ],
    range: [
      {
        accepts: (args) =>
          isRangeCase({
            args,
            hasEndForm: true,
            hasOptionsParameter: false,
            optionKeys: ["step"],
            shouldBoundEveryCount: false,
          }),
        call: "range(start, end, step)",
        run: (args) => callWithRange({ args, call: esToolkitRange }),
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
