import { parse } from "qs";

import type { Tool } from "./tool.mts";

import {
  isSearchParamCase,
  isSearchParamsCase,
  markKeyed,
  packageVersion,
} from "./tool.mts";

/** qs, Express's query-string parser, which can split comma lists itself. */
export const QS: Tool = {
  functions: {
    getSearchParams: [
      {
        accepts: (args) => isSearchParamsCase({ args, separator: undefined }),
        call: "qs.parse(value)",
        run: ([value]) => markKeyed(parse(value as string)),
      },
      {
        accepts: (args) => isSearchParamsCase({ args, separator: "," }),
        call: "qs.parse(value, { comma: true })",
        run: ([value]) => markKeyed(parse(value as string, { comma: true })),
      },
    ],
    getSearchParamValues: [
      {
        accepts: (args) => isSearchParamCase({ args, separator: undefined }),
        call: "qs.parse(value)[key]",
        run: ([value, key]) => parse(value as string)[key as string],
      },
      {
        accepts: (args) => isSearchParamCase({ args, separator: "," }),
        call: "qs.parse(value, { comma: true })[key]",
        run: ([value, key]) =>
          parse(value as string, { comma: true })[key as string],
      },
    ],
  },
  name: "qs",
  tier: 1,
  version: packageVersion("qs"),
};
