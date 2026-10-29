import anyAscii from "any-ascii";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** any-ascii, which transliterates every script to ASCII from its own tables. */
export const ANY_ASCII: Tool = {
  functions: {
    toBasicAscii: [
      {
        accepts: isString,
        call: "anyAscii(value)",
        run: ([value]) => anyAscii(value as string),
      },
    ],
  },
  name: "any-ascii",
  tier: 1,
  version: packageVersion("any-ascii"),
};
