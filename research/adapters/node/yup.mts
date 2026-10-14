import { boolean as yupBoolean } from "yup";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** yup's casting schemas. */
export const YUP: Tool = {
  functions: {
    safeParseBoolean: [
      {
        call: "boolean().validateSync(value)",
        run: ([value]) => yupBoolean().validateSync(value),
      },
    ],
  },
  name: "yup",
  tier: 4,
  version: packageVersion("yup"),
};
