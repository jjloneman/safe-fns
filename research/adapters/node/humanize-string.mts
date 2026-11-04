import humanizeString from "humanize-string";

import type { Tool } from "./tool.mts";

import { converterProbe, packageVersion } from "./tool.mts";

/** humanize-string, which turns an identifier into a sentence-case phrase. */
export const HUMANIZE_STRING: Tool = {
  functions: {
    sentenceCase: [
      converterProbe({
        call: "humanizeString(value)",
        convert: humanizeString,
      }),
    ],
  },
  name: "humanize-string",
  tier: 1,
  version: packageVersion("humanize-string"),
};
