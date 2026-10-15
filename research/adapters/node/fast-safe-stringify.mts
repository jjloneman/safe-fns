import safeStringify from "fast-safe-stringify";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/**
 * fast-safe-stringify, which writes a cycle as `"[Circular]"` and keeps
 * insertion order; its `stableStringify` sorts keys.
 */
export const FAST_SAFE_STRINGIFY: Tool = {
  functions: {
    safeJsonStringify: [
      {
        call: "safeStringify(value)",
        run: ([value]) => safeStringify(value),
      },
    ],
  },
  name: "fast-safe-stringify",
  tier: 1,
  version: packageVersion("fast-safe-stringify"),
};
