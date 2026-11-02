import queryString from "query-string";

import type { Tool } from "./tool.mts";

import {
  isSearchParamCase,
  isSearchParamsCase,
  markKeyed,
  packageVersion,
  readSearchParamSeparator,
} from "./tool.mts";

/** query-string, sindresorhus's parser, with a comma array format. */
export const QUERY_STRING: Tool = {
  functions: {
    getSearchParams: [
      {
        accepts: (args) => isSearchParamsCase({ args, separator: undefined }),
        call: "queryString.parse(value)",
        run: ([value]) => markKeyed(queryString.parse(value as string)),
      },
      {
        accepts: (args) => isSearchParamsCase({ args, separator: "," }),
        call: 'queryString.parse(value, { arrayFormat: "comma" })',
        run: ([value]) =>
          markKeyed(
            queryString.parse(value as string, { arrayFormat: "comma" })
          ),
      },
    ],
    getSearchParamValues: [
      {
        accepts: (args) => isSearchParamCase({ args, separator: undefined }),
        call: "queryString.parse(value)[key]",
        run: ([value, key]) =>
          queryString.parse(value as string)[key as string],
      },
      {
        accepts: (args) => isSearchParamCase({ args, separator: undefined }),
        call: "queryString.parseUrl(value).query[key]",
        run: ([value, key]) =>
          queryString.parseUrl(value as string).query[key as string],
      },
      {
        accepts: (args) => isSearchParamCase({ args, separator: "," }),
        call: 'queryString.parse(value, { arrayFormat: "comma" })[key]',
        run: ([value, key]) =>
          queryString.parse(value as string, { arrayFormat: "comma" })[
            key as string
          ],
      },
      {
        accepts: (args) => {
          const separator = readSearchParamSeparator(args);

          return (
            typeof separator === "string" &&
            separator.length === 1 &&
            isSearchParamCase({ args, separator })
          );
        },
        call: 'queryString.parse(value, { arrayFormat: "separator", arrayFormatSeparator: separator })[key]',
        run: (args) =>
          queryString.parse(args[0] as string, {
            arrayFormat: "separator",
            arrayFormatSeparator: readSearchParamSeparator(args) as string,
          })[args[1] as string],
      },
    ],
  },
  name: "query-string",
  tier: 1,
  version: packageVersion("query-string"),
};
