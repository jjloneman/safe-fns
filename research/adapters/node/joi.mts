import Joi from "joi";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** joi's converting schemas. */
export const JOI: Tool = {
  functions: {
    safeParseBoolean: [
      {
        call: "Joi.attempt(value, Joi.boolean())",
        run: ([value]) => Joi.attempt(value, Joi.boolean()),
      },
    ],
  },
  name: "joi",
  tier: 4,
  version: packageVersion("joi"),
};
