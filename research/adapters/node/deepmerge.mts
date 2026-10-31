import deepmerge from "deepmerge";

import type { Tool } from "./tool.mts";

import { isConcatPair, isPair, markClone, packageVersion } from "./tool.mts";

/** deepmerge, which concatenates arrays rather than replacing them. */
export const DEEPMERGE: Tool = {
  functions: {
    deepMerge: [
      {
        accepts: (args) => isPair(args) || isConcatPair(args),
        call: "deepmerge(defaults, overrides)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: deepmerge(defaults as object, overrides as object),
            source: [defaults, overrides],
          }),
      },
    ],
  },
  name: "deepmerge",
  tier: 1,
  version: packageVersion("deepmerge"),
};
