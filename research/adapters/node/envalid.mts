import { bool } from "envalid";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** envalid's environment-variable validators. */
export const ENVALID: Tool = {
  functions: {
    safeParseBoolean: [
      {
        accepts: isString,
        call: "bool()._parse(value)",
        run: ([value]) => bool()._parse(value as string),
      },
    ],
  },
  name: "envalid",
  tier: 4,
  version: packageVersion("envalid"),
};
