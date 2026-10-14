import yn from "yn";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** yn, the yes/no string parser. */
export const YN: Tool = {
  functions: {
    safeParseBoolean: [{ call: "yn(value)", run: ([value]) => yn(value) }],
  },
  name: "yn",
  tier: 1,
  version: packageVersion("yn"),
};
