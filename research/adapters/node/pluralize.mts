import pluralize from "pluralize";

import type { Tool } from "./tool.mts";

import { isPluralizeCase, packageVersion } from "./tool.mts";

/** pluralize, which carries its own English inflection dictionary. */
export const PLURALIZE: Tool = {
  functions: {
    pluralize: [
      {
        accepts: (args) =>
          isPluralizeCase(args, (options) => options === undefined),
        call: "pluralize(word, count)",
        run: ([word, count]) => pluralize(word as string, count as number),
      },
      {
        accepts: (args) =>
          isPluralizeCase(
            args,
            (options) =>
              options?.includeCount === true && options.plural === undefined
          ),
        call: "pluralize(word, count, true)",
        run: ([word, count]) =>
          pluralize(word as string, count as number, true),
      },
    ],
  },
  name: "pluralize",
  tier: 1,
  version: packageVersion("pluralize"),
};
