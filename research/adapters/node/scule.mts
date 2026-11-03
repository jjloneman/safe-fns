import {
  camelCase as sculeCamelCase,
  flatCase as sculeFlatCase,
  kebabCase as sculeKebabCase,
  pascalCase as sculePascalCase,
  snakeCase as sculeSnakeCase,
  splitByCase as sculeSplitByCase,
  titleCase as sculeTitleCase,
  trainCase as sculeTrainCase,
} from "scule";

import type { Tool } from "./tool.mts";

import { converterProbe, packageVersion } from "./tool.mts";

/** scule, UnJS's string case utilities. */
export const SCULE: Tool = {
  functions: {
    camelCase: [
      converterProbe({ call: "camelCase(value)", convert: sculeCamelCase }),
    ],
    flatCase: [
      converterProbe({ call: "flatCase(value)", convert: sculeFlatCase }),
    ],
    kebabCase: [
      converterProbe({ call: "kebabCase(value)", convert: sculeKebabCase }),
    ],
    pascalCase: [
      converterProbe({ call: "pascalCase(value)", convert: sculePascalCase }),
    ],
    snakeCase: [
      converterProbe({ call: "snakeCase(value)", convert: sculeSnakeCase }),
    ],
    titleCase: [
      converterProbe({ call: "titleCase(value)", convert: sculeTitleCase }),
    ],
    trainCase: [
      converterProbe({ call: "trainCase(value)", convert: sculeTrainCase }),
    ],
    words: [
      converterProbe({ call: "splitByCase(value)", convert: sculeSplitByCase }),
    ],
  },
  name: "scule",
  tier: 1,
  version: packageVersion("scule"),
};
