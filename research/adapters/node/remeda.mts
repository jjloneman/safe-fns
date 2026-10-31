import {
  capitalize as remedaCapitalize,
  clone as remedaClone,
  indexBy as remedaIndexBy,
  isDeepEqual as remedaIsDeepEqual,
  isEmpty as remedaIsEmpty,
  isEmptyish as remedaIsEmptyish,
  isPlainObject as remedaIsPlainObject,
  mergeDeep as remedaMergeDeep,
  range as remedaRange,
  uncapitalize as remedaUncapitalize,
} from "remeda";

import type { Tool } from "./tool.mts";

import {
  hasNoOptions,
  isPair,
  isRangeCase,
  keyGetter,
  markClone,
  markKeyed,
  packageVersion,
} from "./tool.mts";

/** remeda's type guards. */
export const REMEDA: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "clone(value)",
        run: ([value]) =>
          markClone({ clone: remedaClone(value), source: value }),
      },
    ],
    deepMerge: [
      {
        accepts: isPair,
        call: "mergeDeep(defaults, overrides)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: remedaMergeDeep(
              defaults as Record<string, unknown>,
              overrides as Record<string, unknown>
            ),
            source: [defaults, overrides],
          }),
      },
    ],
    isDeepEqual: [
      {
        accepts: isPair,
        call: "isDeepEqual(a, b)",
        run: ([a, b]) => remedaIsDeepEqual(a, b),
      },
    ],
    isPlainObject: [
      {
        call: "isPlainObject(value)",
        run: ([value]) => remedaIsPlainObject(value),
      },
    ],
    isSafeEmpty: [
      {
        call: "isEmpty(value)",
        run: ([value]) => remedaIsEmpty(value as string),
      },
      {
        call: "isEmptyish(value)",
        run: ([value]) => remedaIsEmptyish(value),
      },
    ],
    keyBy: [
      {
        accepts: isPair,
        call: "indexBy(items, getKey)",
        run: ([items, key]) =>
          markKeyed(
            remedaIndexBy(
              items as readonly unknown[],
              keyGetter(key) as (item: unknown) => PropertyKey
            )
          ),
      },
    ],
    lowerFirst: [
      {
        accepts: hasNoOptions,
        call: "uncapitalize(value)",
        run: ([value]) => remedaUncapitalize(value as string),
      },
    ],
    range: [
      {
        accepts: (args) =>
          isRangeCase({
            args,
            hasEndForm: false,
            hasOptionsParameter: false,
            optionKeys: ["step"],
            shouldBoundEveryCount: false,
          }),
        call: "range(start, { end, step })",
        run: ([start, end, options]) =>
          options === undefined
            ? remedaRange(start as number, end as number)
            : remedaRange(start as number, {
                end: end as number,
                step: (options as { step: number }).step,
              }),
      },
    ],
    upperFirst: [
      {
        accepts: hasNoOptions,
        call: "capitalize(value)",
        run: ([value]) => remedaCapitalize(value as string),
      },
    ],
  },
  name: "remeda",
  tier: 1,
  version: packageVersion("remeda"),
};
