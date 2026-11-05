// humps is a UMD bundle, so Node sees only its default export.
import humps from "humps";

import type { Tool } from "./tool.mts";

import { excludeKeysProbe, keysProbe, packageVersion } from "./tool.mts";

/** humps, which converts an object's keys, at every depth. */
export const HUMPS: Tool = {
  functions: {
    camelCaseKeys: [
      keysProbe({
        call: "camelizeKeys(value)",
        convert: (value) => humps.camelizeKeys(value),
      }),
      excludeKeysProbe({
        call: "camelizeKeys(value, (key, convert) => exclude.includes(key) ? key : convert(key))",
        convert: (value, exclude) =>
          humps.camelizeKeys(value, (key, convert) =>
            exclude.includes(key) ? key : convert(key)
          ),
      }),
    ],
    snakeCaseKeys: [
      keysProbe({
        call: "decamelizeKeys(value)",
        convert: (value) => humps.decamelizeKeys(value),
        keepsOuterUnderscores: true,
      }),
      excludeKeysProbe({
        call: "decamelizeKeys(value, (key, convert) => exclude.includes(key) ? key : convert(key))",
        convert: (value, exclude) =>
          humps.decamelizeKeys(value, (key, convert) =>
            exclude.includes(key) ? key : convert(key)
          ),
      }),
    ],
  },
  name: "humps",
  tier: 1,
  version: packageVersion("humps"),
};
