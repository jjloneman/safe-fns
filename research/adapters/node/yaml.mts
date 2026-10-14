import { parse as parseYaml } from "yaml";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

// Typed wrappers: the yaml library returns `any`.
function parseYaml11(text: string): unknown {
  return parseYaml(text, { version: "1.1" });
}
function parseYaml12(text: string): unknown {
  return parseYaml(text);
}

/** YAML 1.1's scalars, with its wide boolean set (`yes`, `on`, `y`). */
export const YAML_1_1: Tool = {
  functions: {
    safeParseBoolean: [
      {
        accepts: isString,
        call: 'parse(value, { version: "1.1" })',
        run: ([value]) => parseYaml11(value as string),
      },
    ],
    safeParseInteger: [
      {
        accepts: isString,
        call: 'parse(value, { version: "1.1" })',
        run: ([value]) => parseYaml11(value as string),
      },
    ],
    safeParseNumber: [
      {
        accepts: isString,
        call: 'parse(value, { version: "1.1" })',
        run: ([value]) => parseYaml11(value as string),
      },
    ],
  },
  name: "YAML 1.1",
  tier: 3,
  version: packageVersion("yaml"),
};

/** YAML 1.2's core schema, the yaml library's default. */
export const YAML_1_2_CORE: Tool = {
  functions: {
    safeParseBoolean: [
      {
        accepts: isString,
        call: "parse(value)",
        run: ([value]) => parseYaml12(value as string),
      },
    ],
    safeParseInteger: [
      {
        accepts: isString,
        call: "parse(value)",
        run: ([value]) => parseYaml12(value as string),
      },
    ],
    safeParseNumber: [
      {
        accepts: isString,
        call: "parse(value)",
        run: ([value]) => parseYaml12(value as string),
      },
    ],
  },
  name: "YAML 1.2 core",
  tier: 3,
  version: packageVersion("yaml"),
};
