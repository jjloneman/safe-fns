import {
  capitalize as remedaCapitalize,
  isEmpty as remedaIsEmpty,
  isEmptyish as remedaIsEmptyish,
  isPlainObject as remedaIsPlainObject,
  uncapitalize as remedaUncapitalize,
} from "remeda";

import type { Tool } from "./tool.mts";

import { hasNoOptions, packageVersion } from "./tool.mts";

/** remeda's type guards. */
export const REMEDA: Tool = {
  functions: {
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
