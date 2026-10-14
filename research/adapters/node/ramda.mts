import { has, isEmpty } from "ramda";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** Ramda, whose functions take the data last. */
export const RAMDA: Tool = {
  functions: {
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
