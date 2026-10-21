import {
  integer,
  parse,
  parseBoolean,
  parseJson,
  pipe,
  string,
  toBigint,
  toNumber,
  toString,
  unknown,
} from "valibot";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** valibot's transforming pipes. */
export const VALIBOT: Tool = {
  functions: {
    safeParseBigInt: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.toBigint()), value)",
        run: ([value]) => parse(pipe(unknown(), toBigint()), value),
      },
    ],
    safeParseBoolean: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.parseBoolean()), value)",
        run: ([value]) => parse(pipe(unknown(), parseBoolean()), value),
      },
    ],
    safeParseInt: [
      {
        call: "v.parse(v.pipe(v.unknown(), v.toNumber(), v.integer()), value)",
        run: ([value]) => parse(pipe(unknown(), toNumber(), integer()), value),
      },
    ],
    safeParseJson: [
      {
        call: "v.parse(v.pipe(v.string(), v.parseJson()), value)",
        run: ([value]) => parse(pipe(string(), parseJson()), value),
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
