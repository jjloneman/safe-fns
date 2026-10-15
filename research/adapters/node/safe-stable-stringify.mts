import { stringify } from "safe-stable-stringify";

import type { Tool } from "./tool.mts";

import { callJsonParse, isString, packageVersion } from "./tool.mts";

/**
 * safe-stable-stringify's default export, with its defaults: keys sorted,
 * cycles written as `"[Circular]"`, and BigInts as numbers.
 */
export const SAFE_STABLE_STRINGIFY: Tool = {
  functions: {
    deepSortObject: [
      {
        accepts: isString,
        call: "stringify(JSON.parse(value))",
        run: ([value]) => stringify(callJsonParse(value as string)),
      },
    ],
    safeJsonStringify: [
      { call: "stringify(value)", run: ([value]) => stringify(value) },
    ],
  },
  name: "safe-stable-stringify",
  tier: 1,
  version: packageVersion("safe-stable-stringify"),
};
