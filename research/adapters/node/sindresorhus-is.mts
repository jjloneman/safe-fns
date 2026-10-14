import is from "@sindresorhus/is";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** `@sindresorhus/is`, whose emptiness checks are each narrowed to one type. */
export const SINDRESORHUS_IS: Tool = {
  functions: {
    isPlainObject: [
      {
        call: "is.plainObject(value)",
        run: ([value]) => is.plainObject(value),
      },
    ],
    isSafeEmpty: [
      {
        call: "is.emptyObject(value)",
        run: ([value]) => is.emptyObject(value),
      },
      {
        call: "is.emptyStringOrWhitespace(value)",
        run: ([value]) => is.emptyStringOrWhitespace(value),
      },
    ],
  },
  name: "@sindresorhus/is",
  tier: 1,
  version: packageVersion("@sindresorhus/is"),
};
