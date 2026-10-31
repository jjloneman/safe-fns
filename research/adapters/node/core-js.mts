import iteratorRange from "core-js-pure/full/iterator/range.js";

import type { Tool } from "./tool.mts";

import { isRangeCase, packageVersion } from "./tool.mts";

/** core-js, whose pure build polyfills the TC39 `Iterator.range` proposal. */
export const CORE_JS: Tool = {
  functions: {
    range: [
      {
        accepts: (args) =>
          isRangeCase({
            args,
            hasEndForm: false,
            hasOptionsParameter: true,
            optionKeys: ["inclusive", "step"],
            shouldBoundEveryCount: true,
          }),
        call: "Array.from(Iterator.range(start, end, option))",
        run: ([start, end, option]) =>
          Array.from(iteratorRange(start, end, option)),
      },
    ],
  },
  name: "core-js",
  tier: 1,
  version: packageVersion("core-js-pure"),
};
