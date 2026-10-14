import isPlainObj from "is-plain-obj";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** is-plain-obj, the single-purpose predicate. */
export const IS_PLAIN_OBJ: Tool = {
  functions: {
    isPlainObject: [
      { call: "isPlainObject(value)", run: ([value]) => isPlainObj(value) },
    ],
  },
  name: "is-plain-obj",
  tier: 1,
  version: packageVersion("is-plain-obj"),
};
