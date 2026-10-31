import { defu } from "defu";

import type { Tool } from "./tool.mts";

import { isPair, markClone, packageVersion } from "./tool.mts";

/** defu, which fills defaults in, leftmost argument first. */
export const DEFU: Tool = {
  functions: {
    deepMerge: [
      {
        accepts: isPair,
        call: "defu(overrides, defaults)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: defu(overrides as object, defaults as object),
            source: [defaults, overrides],
          }),
      },
    ],
  },
  name: "defu",
  tier: 1,
  version: packageVersion("defu"),
};
