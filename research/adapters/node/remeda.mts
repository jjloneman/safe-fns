import {
  capitalize as remedaCapitalize,
  clone as remedaClone,
  isDeepEqual as remedaIsDeepEqual,
  isEmpty as remedaIsEmpty,
  isEmptyish as remedaIsEmptyish,
  isPlainObject as remedaIsPlainObject,
  uncapitalize as remedaUncapitalize,
} from "remeda";

import type { Tool } from "./tool.mts";

import { hasNoOptions, isPair, markClone, packageVersion } from "./tool.mts";

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
    lowerFirst: [
      {
        accepts: hasNoOptions,
        call: "uncapitalize(value)",
        run: ([value]) => remedaUncapitalize(value as string),
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
