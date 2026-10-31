import lodash from "lodash";

import type { Tool } from "./tool.mts";

import {
  callWithRange,
  hasNoOptions,
  hasOnlyOptions,
  isConcatPair,
  isPair,
  isRangeCase,
  markClone,
  markKeyed,
  markReferences,
  packageVersion,
} from "./tool.mts";

/** lodash's checks and coercions. */
export const LODASH: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "_.cloneDeep(value)",
        run: ([value]) =>
          markClone({ clone: lodash.cloneDeep(value), source: value }),
      },
    ],
    deepMerge: [
      {
        accepts: isPair,
        call: "_.merge({}, defaults, overrides)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: lodash.merge({}, defaults, overrides),
            source: [defaults, overrides],
          }),
      },
      {
        accepts: isPair,
        call: "_.defaultsDeep({}, overrides, defaults)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: lodash.defaultsDeep({}, overrides, defaults),
            source: [defaults, overrides],
          }),
      },
      {
        accepts: isConcatPair,
        call: "_.mergeWith({}, defaults, overrides, concatArrays)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: lodash.mergeWith({}, defaults, overrides, concatArrays),
            source: [defaults, overrides],
          }),
      },
    ],
    isDeepEqual: [
      {
        accepts: isPair,
        call: "_.isEqual(a, b)",
        run: ([a, b]) => lodash.isEqual(a, b),
      },
    ],
    isPlainObject: [
      {
        call: "_.isPlainObject(value)",
        run: ([value]) => lodash.isPlainObject(value),
      },
    ],
    isSafeEmpty: [
      { call: "_.isEmpty(value)", run: ([value]) => lodash.isEmpty(value) },
    ],
    keyBy: [
      {
        accepts: isPair,
        call: "_.keyBy(items, key)",
        run: ([items, key]) =>
          markKeyed(
            lodash.keyBy(
              items as readonly unknown[],
              key as Parameters<typeof lodash.keyBy>[1]
            )
          ),
      },
    ],
    lowerFirst: [
      {
        accepts: hasNoOptions,
        call: "_.lowerFirst(value)",
        run: ([value]) => lodash.lowerFirst(value as string),
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
        call: "_.range(start, end, step)",
        run: (args) => callWithRange({ args, call: lodash.range.bind(lodash) }),
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
      {
        call: "_.deburr(value)",
        run: ([value]) => lodash.deburr(value as string),
      },
    ],
    trimBlank: [
      { call: "_.trim(value)", run: ([value]) => lodash.trim(value as string) },
    ],
    upperFirst: [
      {
        accepts: hasNoOptions,
        call: "_.upperFirst(value)",
        run: ([value]) => lodash.upperFirst(value as string),
      },
      {
        accepts: (args) =>
          hasNoOptions(args) ||
          (hasOnlyOptions(args, ["lowerRest"]) &&
            (args[1] as Record<string, unknown>).lowerRest === true),
        call: "_.capitalize(value)",
        run: ([value]) => lodash.capitalize(value as string),
      },
    ],
  },
  name: "lodash",
  tier: 1,
  version: packageVersion("lodash"),
};

/**
 * Concatenate two arrays, the customizer lodash's `mergeWith` docs show;
 * anything else is left to lodash's own merge.
 */
function concatArrays(objectValue: unknown, sourceValue: unknown): unknown {
  if (Array.isArray(objectValue)) {
    return objectValue.concat(sourceValue);
  }

  return undefined;
}
