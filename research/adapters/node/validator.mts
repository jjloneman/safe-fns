import validator from "validator";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

/** validator.js, which takes strings only and throws on anything else. */
export const VALIDATOR: Tool = {
  functions: {
    isSafeEmpty: [
      {
        accepts: isString,
        call: "validator.isEmpty(value, { ignore_whitespace: true })",
        run: ([value]) =>
          validator.isEmpty(value as string, { ignore_whitespace: true }),
      },
    ],
    safeParseBoolean: [
      {
        accepts: isString,
        call: "validator.toBoolean(value, true)",
        run: ([value]) => validator.toBoolean(value as string, true),
      },
    ],
    safeParseInteger: [
      {
        accepts: isString,
        call: "validator.toInt(value, 10)",
        run: ([value]) => validator.toInt(value as string, 10),
      },
    ],
    safeParseNumber: [
      {
        accepts: isString,
        call: "validator.toFloat(value)",
        run: ([value]) => validator.toFloat(value as string),
      },
    ],
  },
  name: "validator.js",
  tier: 4,
  version: packageVersion("validator"),
};
