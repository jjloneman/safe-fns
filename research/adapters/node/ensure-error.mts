import ensureError from "ensure-error";

import type { Tool } from "./tool.mts";

import { packageVersion, summarizeError } from "./tool.mts";

/** ensure-error, which turns any thrown value into an `Error`. */
export const ENSURE_ERROR: Tool = {
  functions: {
    getErrorMessage: [
      {
        call: "ensureError(value).message",
        run: ([value]) => ensureError(value).message,
      },
    ],
    toError: [
      {
        call: "ensureError(value) → { message, unchanged }",
        run: ([value]) =>
          summarizeError({ error: ensureError(value), input: value }),
      },
    ],
  },
  name: "ensure-error",
  tier: 1,
  version: packageVersion("ensure-error"),
};
