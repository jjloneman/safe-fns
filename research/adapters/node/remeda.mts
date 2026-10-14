import {
  isEmpty as remedaIsEmpty,
  isEmptyish as remedaIsEmptyish,
  isPlainObject as remedaIsPlainObject,
} from "remeda";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

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
  },
  name: "remeda",
  tier: 1,
  version: packageVersion("remeda"),
};
