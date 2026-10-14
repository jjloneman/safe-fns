import { parse } from "ini";

import type { Probe, Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

// Typed wrapper: ini returns a loosely typed record.
function parseIniValue(text: string): unknown {
  return parse(`v = ${text}`).v;
}

/** A case as the value of a one-key INI document. */
const INI_VALUE: Probe = {
  accepts: isString,
  call: "parse(`v = ${value}`).v",
  run: ([value]) => parseIniValue(value as string),
};

/** INI, which has no spec; npm's `ini` is the common convention. */
export const INI: Tool = {
  functions: {
    safeParseBoolean: [INI_VALUE],
    safeParseInteger: [INI_VALUE],
    safeParseNumber: [INI_VALUE],
  },
  name: "INI",
  tier: 3,
  version: `ini ${packageVersion("ini")}`,
};
