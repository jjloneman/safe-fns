import { clone, equals, has, isEmpty, mergeDeepRight, range } from "ramda";

import type { Tool } from "./tool.mts";

import {
  hasNoOptions,
  isPair,
  isRangeCase,
  markClone,
  packageVersion,
} from "./tool.mts";

/** Ramda, whose functions take the data last. */
export const RAMDA: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "clone(value)",
        run: ([value]) => markClone({ clone: clone(value), source: value }),
      },
    ],
    deepMerge: [
      {
        accepts: isPair,
        call: "mergeDeepRight(defaults, overrides)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: mergeDeepRight(defaults as object, overrides as object),
            source: [defaults, overrides],
          }),
      },
    ],
    isDeepEqual: [
      {
        accepts: isPair,
        call: "equals(a, b)",
        run: ([a, b]) => equals(a, b),
      },
    ],
    isSafeEmpty: [
      { call: "R.isEmpty(value)", run: ([value]) => isEmpty(value) },
    ],
    range: [
      {
        accepts: (args) =>
          isRangeCase({
            args,
            hasEndForm: false,
            hasOptionsParameter: false,
            optionKeys: [],
            shouldBoundEveryCount: false,
          }),
        call: "range(from, to)",
        run: ([from, to]) => range(from as number, to as number),
      },
    ],
    safeObjectHasOwn: [
      {
        call: "R.has(key, object)",
        run: ([object, key]) => has(key as string, object as object),
      },
    ],
  },
  name: "Ramda",
  tier: 1,
  version: packageVersion("ramda"),
};
