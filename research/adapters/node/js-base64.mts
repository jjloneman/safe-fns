import { Base64 } from "js-base64";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** js-base64, which reads and writes UTF-8 text rather than Latin-1. */
export const JS_BASE64: Tool = {
  functions: {
    decodeBase64: [
      {
        accepts: isString,
        call: "Base64.decode(value)",
        run: ([value]) => Base64.decode(value as string),
      },
    ],
    encodeBase64: [
      {
        accepts: isString,
        call: "Base64.encode(value)",
        run: ([value]) => Base64.encode(value as string),
      },
      {
        accepts: ([value]) => value instanceof Uint8Array,
        call: "Base64.fromUint8Array(value)",
        run: ([value]) => Base64.fromUint8Array(value as Uint8Array),
      },
    ],
  },
  name: "js-base64",
  tier: 1,
  version: packageVersion("js-base64"),
};
