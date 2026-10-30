import { dequal } from "dequal";

import type { Tool } from "./tool.mts";

import { isPair, packageVersion } from "./tool.mts";

/** dequal, a small deep equality check that compares `Map` and `Set` too. */
export const DEQUAL: Tool = {
  functions: {
    isDeepEqual: [
      { accepts: isPair, call: "dequal(a, b)", run: ([a, b]) => dequal(a, b) },
    ],
  },
  name: "dequal",
  tier: 1,
  version: packageVersion("dequal"),
};
