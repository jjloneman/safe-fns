import canonicalize from "canonicalize";

import type { Tool } from "./tool.mts";

import { callJsonParse, isString, packageVersion } from "./tool.mts";

/** canonicalize, an RFC 8785 (JSON Canonicalization Scheme) implementation. */
export const CANONICALIZE: Tool = {
  functions: {
    deepSortObject: [
      {
        accepts: isString,
        call: "canonicalize(JSON.parse(value))",
        run: ([value]) => canonicalize(callJsonParse(value as string)),
      },
    ],
  },
  name: "canonicalize",
  tier: 1,
  version: packageVersion("canonicalize"),
};
