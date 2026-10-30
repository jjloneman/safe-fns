import { clone, equals, has, isEmpty } from "ramda";

import type { Tool } from "./tool.mts";

import { hasNoOptions, isPair, markClone, packageVersion } from "./tool.mts";

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
