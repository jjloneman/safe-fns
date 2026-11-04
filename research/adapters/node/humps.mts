// humps is a UMD bundle, so Node sees only its default export.
import humps from "humps";

import type { Tool } from "./tool.mts";

import { keysProbe, packageVersion } from "./tool.mts";

/** humps, which converts an object's keys, at every depth. */
export const HUMPS: Tool = {
  functions: {
    camelCaseKeys: [
      keysProbe({
        call: "camelizeKeys(value)",
        convert: (value) => humps.camelizeKeys(value),
      }),
    ],
    snakeCaseKeys: [
      keysProbe({
        call: "decamelizeKeys(value)",
        convert: (value) => humps.decamelizeKeys(value),
        keepsOuterUnderscores: true,
      }),
    ],
  },
  name: "humps",
  tier: 1,
  version: packageVersion("humps"),
};
