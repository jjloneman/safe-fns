import decodeUriComponent from "decode-uri-component";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** decode-uri-component, which decodes what it can and keeps the rest. */
export const DECODE_URI_COMPONENT: Tool = {
  functions: {
    safeDecodeUriComponent: [
      {
        accepts: isString,
        call: "decodeUriComponent(value)",
        run: ([value]) => decodeUriComponent(value as string),
      },
    ],
  },
  name: "decode-uri-component",
  tier: 1,
  version: packageVersion("decode-uri-component"),
};
