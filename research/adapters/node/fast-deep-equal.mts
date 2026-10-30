import fastDeepEqual from "fast-deep-equal";
import fastDeepEqualEs6 from "fast-deep-equal/es6/index.js";

import type { Tool } from "./tool.mts";

import { isPair, packageVersion } from "./tool.mts";

/** fast-deep-equal, the most-downloaded deep equality check on npm. */
export const FAST_DEEP_EQUAL: Tool = {
  functions: {
    isDeepEqual: [
      {
        accepts: isPair,
        call: "equal(a, b)",
        run: ([a, b]) => fastDeepEqual(a, b),
      },
      {
        accepts: isPair,
        call: 'equal(a, b) from "fast-deep-equal/es6"',
        run: ([a, b]) => fastDeepEqualEs6(a, b),
      },
    ],
  },
  name: "fast-deep-equal",
  tier: 1,
  version: packageVersion("fast-deep-equal"),
};
