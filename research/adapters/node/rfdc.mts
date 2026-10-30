import rfdc from "rfdc";

import type { Tool } from "./tool.mts";

import { hasNoOptions, markClone, packageVersion } from "./tool.mts";

/** rfdc's default clone, built once as its docs advise. */
const CLONE = rfdc();

/** rfdc's clone, set to also copy circular references. */
const CLONE_CIRCLES = rfdc({ circles: true });

/** rfdc, "really fast deep clone", for JSON-like data. */
export const RFDC: Tool = {
  functions: {
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "rfdc()(value)",
        run: ([value]) => markClone({ clone: CLONE(value), source: value }),
      },
      {
        accepts: hasNoOptions,
        call: "rfdc({ circles: true })(value)",
        run: ([value]) =>
          markClone({ clone: CLONE_CIRCLES(value), source: value }),
      },
    ],
  },
  name: "rfdc",
  tier: 1,
  version: packageVersion("rfdc"),
};
