import {
  adaCase as caseAnythingAdaCase,
  camelCase as caseAnythingCamelCase,
  capitalCase as caseAnythingCapitalCase,
  cobolCase as caseAnythingCobolCase,
  constantCase as caseAnythingConstantCase,
  dotNotation as caseAnythingDotNotation,
  kebabCase as caseAnythingKebabCase,
  lowerCase as caseAnythingLowerCase,
  pascalCase as caseAnythingPascalCase,
  pathCase as caseAnythingPathCase,
  snakeCase as caseAnythingSnakeCase,
  trainCase as caseAnythingTrainCase,
  upperCase as caseAnythingUpperCase,
} from "case-anything";

import type { Tool } from "./tool.mts";

import { converterProbe, packageVersion } from "./tool.mts";

/** case-anything, a case conversion library. */
export const CASE_ANYTHING: Tool = {
  functions: {
    camelCase: [
      converterProbe({
        call: "camelCase(value)",
        convert: caseAnythingCamelCase,
        splitsNumbers: true,
      }),
    ],
    constantCase: [
      converterProbe({
        call: "constantCase(value)",
        convert: caseAnythingConstantCase,
        splitsNumbers: true,
      }),
    ],
    dotCase: [
      converterProbe({
        call: "dotNotation(value)",
        convert: caseAnythingDotNotation,
        splitsNumbers: true,
      }),
    ],
    kebabCase: [
      converterProbe({
        call: "kebabCase(value)",
        convert: caseAnythingKebabCase,
        splitsNumbers: true,
      }),
    ],
    lowerCase: [
      converterProbe({
        call: "lowerCase(value)",
        convert: caseAnythingLowerCase,
        splitsNumbers: true,
      }),
    ],
    pascalCase: [
      converterProbe({
        call: "pascalCase(value)",
        convert: caseAnythingPascalCase,
        splitsNumbers: true,
      }),
    ],
    pascalSnakeCase: [
      converterProbe({
        call: "adaCase(value)",
        convert: caseAnythingAdaCase,
        splitsNumbers: true,
      }),
    ],
    pathCase: [
      converterProbe({
        call: "pathCase(value)",
        convert: caseAnythingPathCase,
        splitsNumbers: true,
      }),
    ],
    screamingKebabCase: [
      converterProbe({
        call: "cobolCase(value)",
        convert: caseAnythingCobolCase,
        splitsNumbers: true,
      }),
    ],
    snakeCase: [
      converterProbe({
        call: "snakeCase(value)",
        convert: caseAnythingSnakeCase,
        splitsNumbers: true,
      }),
    ],
    titleCase: [
      converterProbe({
        call: "capitalCase(value)",
        convert: caseAnythingCapitalCase,
        splitsNumbers: true,
      }),
    ],
    trainCase: [
      converterProbe({
        call: "trainCase(value)",
        convert: caseAnythingTrainCase,
        splitsNumbers: true,
      }),
    ],
    upperCase: [
      converterProbe({
        call: "upperCase(value)",
        convert: caseAnythingUpperCase,
        splitsNumbers: true,
      }),
    ],
  },
  name: "case-anything",
  tier: 1,
  version: packageVersion("case-anything"),
};
