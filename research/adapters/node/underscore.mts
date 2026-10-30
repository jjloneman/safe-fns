import underscore from "underscore";

import type { Tool } from "./tool.mts";

import { isPair, packageVersion } from "./tool.mts";

/** Underscore, lodash's predecessor; it has no plain-object check. */
export const UNDERSCORE: Tool = {
  functions: {
    isDeepEqual: [
      {
        accepts: isPair,
        call: "_.isEqual(a, b)",
        run: ([a, b]) => underscore.isEqual(a, b),
      },
    ],
    isSafeEmpty: [
      { call: "_.isEmpty(value)", run: ([value]) => underscore.isEmpty(value) },
    ],
    safeObjectHasOwn: [
      {
        call: "_.has(object, key)",
        run: ([object, key]) => underscore.has(object, key as string),
      },
    ],
  },
  name: "Underscore",
  tier: 1,
  version: packageVersion("underscore"),
};
