import type { Options } from "change-case";

import {
  camelCase as changeCaseCamelCase,
  capitalCase as changeCaseCapitalCase,
  constantCase as changeCaseConstantCase,
  dotCase as changeCaseDotCase,
  kebabCase as changeCaseKebabCase,
  noCase as changeCaseNoCase,
  pascalCase as changeCasePascalCase,
  pascalSnakeCase as changeCasePascalSnakeCase,
  pathCase as changeCasePathCase,
  sentenceCase as changeCaseSentenceCase,
  snakeCase as changeCaseSnakeCase,
  split as changeCaseSplit,
  splitSeparateNumbers as changeCaseSplitSeparateNumbers,
  trainCase as changeCaseTrainCase,
} from "change-case";

import type { Probe, Tool } from "./tool.mts";

import { converterProbe, packageVersion } from "./tool.mts";

/** change-case, a case conversion library. */
export const CHANGE_CASE: Tool = {
  functions: {
    camelCase: [
      converterProbe({
        call: "camelCase(value)",
        convert: changeCaseCamelCase,
      }),
      splitSeparateProbe({ call: "camelCase", convert: changeCaseCamelCase }),
      outerUnderscoresProbe({
        call: "camelCase",
        convert: changeCaseCamelCase,
      }),
    ],
    constantCase: [
      converterProbe({
        call: "constantCase(value)",
        convert: changeCaseConstantCase,
      }),
      splitSeparateProbe({
        call: "constantCase",
        convert: changeCaseConstantCase,
      }),
      outerUnderscoresProbe({
        call: "constantCase",
        convert: changeCaseConstantCase,
      }),
    ],
    dotCase: [
      converterProbe({ call: "dotCase(value)", convert: changeCaseDotCase }),
      splitSeparateProbe({ call: "dotCase", convert: changeCaseDotCase }),
      outerUnderscoresProbe({ call: "dotCase", convert: changeCaseDotCase }),
    ],
    kebabCase: [
      converterProbe({
        call: "kebabCase(value)",
        convert: changeCaseKebabCase,
      }),
      splitSeparateProbe({ call: "kebabCase", convert: changeCaseKebabCase }),
      outerUnderscoresProbe({
        call: "kebabCase",
        convert: changeCaseKebabCase,
      }),
    ],
    lowerCase: [
      converterProbe({ call: "noCase(value)", convert: changeCaseNoCase }),
      splitSeparateProbe({ call: "noCase", convert: changeCaseNoCase }),
      outerUnderscoresProbe({ call: "noCase", convert: changeCaseNoCase }),
    ],
    pascalCase: [
      converterProbe({
        call: "pascalCase(value)",
        convert: changeCasePascalCase,
      }),
      splitSeparateProbe({ call: "pascalCase", convert: changeCasePascalCase }),
      outerUnderscoresProbe({
        call: "pascalCase",
        convert: changeCasePascalCase,
      }),
    ],
    pascalSnakeCase: [
      converterProbe({
        call: "pascalSnakeCase(value)",
        convert: changeCasePascalSnakeCase,
      }),
      splitSeparateProbe({
        call: "pascalSnakeCase",
        convert: changeCasePascalSnakeCase,
      }),
      outerUnderscoresProbe({
        call: "pascalSnakeCase",
        convert: changeCasePascalSnakeCase,
      }),
    ],
    pathCase: [
      converterProbe({ call: "pathCase(value)", convert: changeCasePathCase }),
      splitSeparateProbe({ call: "pathCase", convert: changeCasePathCase }),
      outerUnderscoresProbe({ call: "pathCase", convert: changeCasePathCase }),
    ],
    sentenceCase: [
      converterProbe({
        call: "sentenceCase(value)",
        convert: changeCaseSentenceCase,
      }),
      splitSeparateProbe({
        call: "sentenceCase",
        convert: changeCaseSentenceCase,
      }),
      outerUnderscoresProbe({
        call: "sentenceCase",
        convert: changeCaseSentenceCase,
      }),
    ],
    snakeCase: [
      converterProbe({
        call: "snakeCase(value)",
        convert: changeCaseSnakeCase,
      }),
      splitSeparateProbe({ call: "snakeCase", convert: changeCaseSnakeCase }),
      outerUnderscoresProbe({
        call: "snakeCase",
        convert: changeCaseSnakeCase,
      }),
    ],
    titleCase: [
      converterProbe({
        call: "capitalCase(value)",
        convert: changeCaseCapitalCase,
      }),
      splitSeparateProbe({
        call: "capitalCase",
        convert: changeCaseCapitalCase,
      }),
      outerUnderscoresProbe({
        call: "capitalCase",
        convert: changeCaseCapitalCase,
      }),
    ],
    trainCase: [
      converterProbe({
        call: "trainCase(value)",
        convert: changeCaseTrainCase,
      }),
      splitSeparateProbe({ call: "trainCase", convert: changeCaseTrainCase }),
      outerUnderscoresProbe({
        call: "trainCase",
        convert: changeCaseTrainCase,
      }),
    ],
    words: [
      converterProbe({ call: "split(value)", convert: changeCaseSplit }),
      converterProbe({
        call: "splitSeparateNumbers(value)",
        convert: changeCaseSplitSeparateNumbers,
        isOptionsOnly: true,
        splitsNumbers: true,
      }),
    ],
  },
  name: "change-case",
  tier: 1,
  version: packageVersion("change-case"),
};

/** A change-case converter that takes options, and the name it's called by. */
type OptionsProbe = {
  /**
   * The converter's name, as the call text shows it.
   *
   * @example "snakeCase"
   */
  call: string;

  /**
   * The converter, called with the options a probe passes.
   *
   * @example `snakeCase`
   */
  convert: (value: string, options: Options) => string;
};

/**
 * A probe for a change-case converter given `prefixCharacters` and
 * `suffixCharacters` of `"_"`, which keep leading and trailing underscores.
 *
 * @returns the probe, which answers only `keepOuterUnderscores: true`.
 */
function outerUnderscoresProbe({ call, convert }: OptionsProbe): Probe {
  return converterProbe({
    call: `${call}(value, { prefixCharacters: "_", suffixCharacters: "_" })`,
    convert: (value) =>
      convert(value, { prefixCharacters: "_", suffixCharacters: "_" }),
    isOptionsOnly: true,
    keepsOuterUnderscores: true,
  });
}

/**
 * A probe for a change-case converter given `splitSeparateNumbers`.
 *
 * @returns the probe, which answers only `splitNumbers: true`.
 */
function splitSeparateProbe({ call, convert }: OptionsProbe): Probe {
  return converterProbe({
    call: `${call}(value, { split: splitSeparateNumbers })`,
    convert: (value) =>
      convert(value, { split: changeCaseSplitSeparateNumbers }),
    isOptionsOnly: true,
    splitsNumbers: true,
  });
}
