import { klona } from "klona";
import { klona as klonaFull } from "klona/full";

import type { Tool } from "./tool.mts";

import { hasNoOptions, markClone, packageVersion } from "./tool.mts";

/** klona, a small deep clone with a fuller build for more built-ins. */
export const KLONA: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "klona(value)",
        run: ([value]) => markClone({ clone: klona(value), source: value }),
      },
      {
        accepts: hasNoOptions,
        call: 'klona(value) from "klona/full"',
        run: ([value]) => markClone({ clone: klonaFull(value), source: value }),
      },
    ],
  },
  name: "klona",
  tier: 1,
  version: packageVersion("klona"),
};
