import type { Probe, Tool } from "./tool.mts";

import { callJsonParse, isString } from "./tool.mts";

/** The one call JSON offers for every scalar. */
const JSON_PARSE: Probe = {
  accepts: isString,
  call: "JSON.parse(value)",
  run: ([value]) => callJsonParse(value as string),
};

/** JSON, the format, read through the runtime's own parser. */
export const JSON_FORMAT: Tool = {
  functions: {
    safeParseBoolean: [JSON_PARSE],
    safeParseInteger: [JSON_PARSE],
    safeParseNumber: [JSON_PARSE],
  },
  name: "JSON",
  tier: 3,
  version: "RFC 8259",
};
