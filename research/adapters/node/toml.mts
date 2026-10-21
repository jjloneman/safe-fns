import { parse } from "smol-toml";

import type { Probe, Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

// TOML has no bare scalars, so each case becomes the value of a one-key table.
function parseTomlValue(text: string): unknown {
  return parse(`v = ${text}`).v;
}

/** The one document TOML reads every scalar through. */
const TOML_VALUE: Probe = {
  accepts: isString,
  call: "parse(`v = ${value}`).v",
  run: ([value]) => parseTomlValue(value as string),
};

/** TOML 1.0, through smol-toml, a spec-compliant parser. */
export const TOML: Tool = {
  functions: {
    safeParseBoolean: [TOML_VALUE],
    safeParseInt: [TOML_VALUE],
    safeParseNumber: [TOML_VALUE],
  },
  name: "TOML",
  tier: 3,
  version: `smol-toml ${packageVersion("smol-toml")}`,
};
