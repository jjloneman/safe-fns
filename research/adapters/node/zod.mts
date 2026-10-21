import { z } from "zod";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** zod's coercing schemas. */
export const ZOD: Tool = {
  functions: {
    safeParseBigInt: [
      {
        call: "z.coerce.bigint().parse(value)",
        run: ([value]) => z.coerce.bigint().parse(value),
      },
    ],
    safeParseBoolean: [
      {
        call: "z.stringbool().parse(value)",
        run: ([value]) => z.stringbool().parse(value),
      },
    ],
    safeParseInt: [
      {
        call: "z.coerce.number().int().parse(value)",
        run: ([value]) => z.coerce.number().int().parse(value),
      },
    ],
    safeParseNumber: [
      {
        call: "z.coerce.number().parse(value)",
        run: ([value]) => z.coerce.number().parse(value),
      },
    ],
    safeParseString: [
      {
        call: "z.coerce.string().parse(value)",
        run: ([value]) => z.coerce.string().parse(value),
      },
    ],
  },
  name: "zod",
  tier: 1,
  version: packageVersion("zod"),
};
