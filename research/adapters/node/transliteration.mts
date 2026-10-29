import { transliterate } from "transliteration";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** transliteration, the most-downloaded general-purpose transliterator. */
export const TRANSLITERATION: Tool = {
  functions: {
    toBasicAscii: [
      {
        accepts: isString,
        call: "transliterate(value)",
        run: ([value]) => transliterate(value as string),
      },
    ],
  },
  name: "transliteration",
  tier: 1,
  version: packageVersion("transliteration"),
};
