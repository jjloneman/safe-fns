import stringify from "fast-json-stable-stringify";

import type { Tool } from "./tool.mts";

import { callJsonParse, isString, packageVersion } from "./tool.mts";

/**
 * fast-json-stable-stringify, which sorts keys and, without `{ cycles: true }`,
 * throws on a cycle.
 */
export const FAST_JSON_STABLE_STRINGIFY: Tool = {
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
  name: "fast-json-stable-stringify",
  tier: 1,
  version: packageVersion("fast-json-stable-stringify"),
};
