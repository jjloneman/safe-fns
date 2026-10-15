import stringify from "json-stringify-safe";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** json-stringify-safe, which writes a cycle as `"[Circular ~…]"`. */
export const JSON_STRINGIFY_SAFE: Tool = {
  functions: {
    safeJsonStringify: [
      { call: "stringify(value)", run: ([value]) => stringify(value) },
    ],
  },
  name: "json-stringify-safe",
  tier: 1,
  version: packageVersion("json-stringify-safe"),
};
