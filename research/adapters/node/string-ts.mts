import {
  camelCase as stringTsCamelCase,
  camelKeys as stringTsCamelKeys,
  constantCase as stringTsConstantCase,
  deepCamelKeys as stringTsDeepCamelKeys,
  deepSnakeKeys as stringTsDeepSnakeKeys,
  delimiterCase as stringTsDelimiterCase,
  kebabCase as stringTsKebabCase,
  pascalCase as stringTsPascalCase,
  snakeCase as stringTsSnakeCase,
  snakeKeys as stringTsSnakeKeys,
  titleCase as stringTsTitleCase,
  words as stringTsWords,
} from "string-ts";

import type { Tool } from "./tool.mts";

import { converterProbe, keysProbe, packageVersion } from "./tool.mts";

/** string-ts, string helpers with type-level twins. */
export const STRING_TS: Tool = {
  functions: {
    camelCase: [
      converterProbe({
        call: "camelCase(value)",
        convert: stringTsCamelCase,
        splitsNumbers: true,
      }),
    ],
    camelCaseKeys: [
      keysProbe({
        call: "deepCamelKeys(value)",
        convert: stringTsDeepCamelKeys,
        splitsNumbers: true,
      }),
      keysProbe({
        call: "camelKeys(value)",
        convert: stringTsCamelKeys,
        isShallow: true,
        splitsNumbers: true,
      }),
    ],
    constantCase: [
      converterProbe({
        call: "constantCase(value)",
        convert: stringTsConstantCase,
        splitsNumbers: true,
      }),
    ],
    dotCase: [
      converterProbe({
        call: 'delimiterCase(value, ".")',
        convert: (value) => stringTsDelimiterCase(value, "."),
        splitsNumbers: true,
      }),
    ],
    kebabCase: [
      converterProbe({
        call: "kebabCase(value)",
        convert: stringTsKebabCase,
        splitsNumbers: true,
      }),
    ],
    pascalCase: [
      converterProbe({
        call: "pascalCase(value)",
        convert: stringTsPascalCase,
        splitsNumbers: true,
      }),
    ],
    pathCase: [
      converterProbe({
        call: 'delimiterCase(value, "/")',
        convert: (value) => stringTsDelimiterCase(value, "/"),
        splitsNumbers: true,
      }),
    ],
    snakeCase: [
      converterProbe({
        call: "snakeCase(value)",
        convert: stringTsSnakeCase,
        splitsNumbers: true,
      }),
    ],
    snakeCaseKeys: [
      keysProbe({
        call: "deepSnakeKeys(value)",
        convert: stringTsDeepSnakeKeys,
        splitsNumbers: true,
      }),
      keysProbe({
        call: "snakeKeys(value)",
        convert: stringTsSnakeKeys,
        isShallow: true,
        splitsNumbers: true,
      }),
    ],
    titleCase: [
      converterProbe({
        call: "titleCase(value)",
        convert: stringTsTitleCase,
        splitsNumbers: true,
      }),
    ],
    words: [
      converterProbe({
        call: "words(value)",
        convert: stringTsWords,
        splitsNumbers: true,
      }),
    ],
  },
  name: "string-ts",
  tier: 1,
  version: packageVersion("string-ts"),
};
