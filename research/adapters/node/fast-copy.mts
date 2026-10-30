import { copy, copyStrict } from "fast-copy";

import type { Tool } from "./tool.mts";

import { hasNoOptions, markClone, packageVersion } from "./tool.mts";

/** fast-copy, a deep copy that keeps prototypes, with a strict mode. */
export const FAST_COPY: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "copy(value)",
        run: ([value]) => markClone({ clone: copy(value), source: value }),
      },
      {
        accepts: hasNoOptions,
        call: "copyStrict(value)",
        run: ([value]) =>
          markClone({ clone: copyStrict(value), source: value }),
      },
    ],
  },
  name: "fast-copy",
  tier: 1,
  version: packageVersion("fast-copy"),
};
