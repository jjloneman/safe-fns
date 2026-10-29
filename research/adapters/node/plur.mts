import plur from "plur";

import type { Tool } from "./tool.mts";

import {
  isPluralizeCase,
  isPluralizeCaseOptions,
  packageVersion,
} from "./tool.mts";

/** plur, sindresorhus's pluralizer, which takes an explicit plural. */
export const PLUR: Tool = {
  functions: {
    pluralize: [
      {
        accepts: (args) =>
          isPluralizeCase(args, (options) => options === undefined),
        call: "plur(word, count)",
        run: ([word, count]) => plur(word as string, count as number),
      },
      {
        accepts: (args) =>
          isPluralizeCase(
            args,
            (options) =>
              typeof options?.plural === "string" &&
              options.includeCount === undefined
          ),
        call: "plur(word, plural, count)",
        run: ([word, count, options]) =>
          isPluralizeCaseOptions(options) && options.plural !== undefined
            ? plur(word as string, options.plural, count as number)
            : plur(word as string, count as number),
      },
    ],
  },
  name: "plur",
  tier: 1,
  version: packageVersion("plur"),
};
