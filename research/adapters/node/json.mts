import type { Probe, Tool } from "./tool.mts";

import { isString } from "./tool.mts";

/*
 * JSON's `JSON.parse`, typed `unknown`.
 *
 * - Called bare on purpose: it's the function under test, so its throw is the
 *   outcome to record, not an error to wrap.
 */
function callJsonParse(text: string): unknown {
  // eslint-disable-next-line no-restricted-properties -- the function under test
  return JSON.parse(text);
}

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
