import fastDecode from "fast-decode-uri-component";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** fast-decode-uri-component, which returns `null` instead of throwing. */
export const FAST_DECODE_URI_COMPONENT: Tool = {
  functions: {
    safeDecodeUriComponent: [
      {
        accepts: isString,
        call: "fastDecode(value)",
        run: ([value]) => fastDecode(value as string),
      },
    ],
  },
  name: "fast-decode-uri-component",
  tier: 1,
  version: packageVersion("fast-decode-uri-component"),
};
