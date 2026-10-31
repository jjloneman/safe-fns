import underscore from "underscore";

import type { Tool } from "./tool.mts";

import {
  callWithRange,
  isPair,
  isRangeCase,
  markKeyed,
  packageVersion,
} from "./tool.mts";

/** Underscore, lodash's predecessor; it has no plain-object check. */
export const UNDERSCORE: Tool = {
  functions: {
    isDeepEqual: [
      {
        accepts: isPair,
        call: "_.isEqual(a, b)",
        run: ([a, b]) => underscore.isEqual(a, b),
      },
    ],
    isSafeEmpty: [
      { call: "_.isEmpty(value)", run: ([value]) => underscore.isEmpty(value) },
    ],
    keyBy: [
      {
        accepts: isPair,
        call: "_.indexBy(items, key)",
        run: ([items, key]) =>
          markKeyed(
            underscore.indexBy(
              items as readonly unknown[],
              key as Parameters<typeof underscore.indexBy>[1]
            )
          ),
      },
    ],
    range: [
      {
        accepts: (args) =>
          isRangeCase({
            args,
            hasEndForm: true,
            hasOptionsParameter: false,
            optionKeys: ["step"],
            shouldBoundEveryCount: false,
          }),
        call: "_.range(start, stop, step)",
        run: (args) =>
          callWithRange({ args, call: underscore.range.bind(underscore) }),
      },
    ],
    safeObjectHasOwn: [
      {
        call: "_.has(object, key)",
        run: ([object, key]) => underscore.has(object, key as string),
      },
    ],
  },
  name: "Underscore",
  tier: 1,
  version: packageVersion("underscore"),
};
