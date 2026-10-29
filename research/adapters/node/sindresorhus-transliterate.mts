import transliterate from "@sindresorhus/transliterate";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** `@sindresorhus/transliterate`, which folds Latin-script text only. */
export const SINDRESORHUS_TRANSLITERATE: Tool = {
  functions: {
    toBasicAscii: [
      {
        accepts: isString,
        call: "transliterate(value)",
        run: ([value]) => transliterate(value as string),
      },
    ],
  },
  name: "@sindresorhus/transliterate",
  tier: 1,
  version: packageVersion("@sindresorhus/transliterate"),
};
