import voca from "voca";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** Voca, a general string library. */
export const VOCA: Tool = {
  functions: {
    toBasicAscii: [
      {
        accepts: isString,
        call: "v.latinise(value)",
        run: ([value]) => voca.latinise(value as string),
      },
    ],
  },
  name: "Voca",
  tier: 1,
  version: packageVersion("voca"),
};
