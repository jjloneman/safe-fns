import {
  integer,
  parse,
  parseBoolean,
  pipe,
  toNumber,
  toString,
  unknown,
} from "valibot";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** valibot's transforming pipes. */
export const VALIBOT: Tool = {
  functions: {
    safeParseBoolean: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.parseBoolean()), value)",
        run: ([value]) => parse(pipe(unknown(), parseBoolean()), value),
      },
    ],
    safeParseInteger: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.toNumber(), v.integer()), value)",
        run: ([value]) => parse(pipe(unknown(), toNumber(), integer()), value),
      },
    ],
    safeParseNumber: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.toNumber()), value)",
        run: ([value]) => parse(pipe(unknown(), toNumber()), value),
      },
    ],
    safeParseString: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.toString()), value)",
        run: ([value]) => parse(pipe(unknown(), toString()), value),
      },
    ],
  },
  name: "valibot",
  tier: 1,
  version: packageVersion("valibot"),
};
