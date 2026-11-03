import voca from "voca";

import type { Tool } from "./tool.mts";

import { converterProbe, isString, packageVersion } from "./tool.mts";

/** Voca, a general string library. */
export const VOCA: Tool = {
  functions: {
    camelCase: [
      converterProbe({
        call: "v.camelCase(value)",
        convert: (value) => voca.camelCase(value),
        splitsNumbers: true,
      }),
    ],
    kebabCase: [
      converterProbe({
        call: "v.kebabCase(value)",
        convert: (value) => voca.kebabCase(value),
        splitsNumbers: true,
      }),
    ],
    snakeCase: [
      converterProbe({
        call: "v.snakeCase(value)",
        convert: (value) => voca.snakeCase(value),
        splitsNumbers: true,
      }),
    ],
    titleCase: [
      converterProbe({
        call: "v.titleCase(value)",
        convert: (value) => voca.titleCase(value),
      }),
    ],
    toBasicAscii: [
      {
        accepts: isString,
        call: "v.latinise(value)",
        run: ([value]) => voca.latinise(value as string),
      },
    ],
    words: [
      converterProbe({
        call: "v.words(value)",
        convert: (value) => voca.words(value),
        splitsNumbers: true,
      }),
    ],
  },
  name: "Voca",
  tier: 1,
  version: packageVersion("voca"),
};
