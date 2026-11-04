import camelcaseKeys from "camelcase-keys";

import type { Tool } from "./tool.mts";

import { keysProbe, packageVersion } from "./tool.mts";

/** The value type camelcase-keys declares, which a case's value is cast to. */
type CamelcaseKeysInput = Parameters<typeof camelcaseKeys>[0];

/** camelcase-keys, which converts an object's keys to camel case. */
export const CAMELCASE_KEYS: Tool = {
  functions: {
    camelCaseKeys: [
      keysProbe({
        call: "camelcaseKeys(value, { deep: true })",
        convert: (value) =>
          camelcaseKeys(value as CamelcaseKeysInput, { deep: true }),
      }),
      keysProbe({
        call: "camelcaseKeys(value)",
        convert: (value) => camelcaseKeys(value as CamelcaseKeysInput),
        isShallow: true,
      }),
    ],
  },
  name: "camelcase-keys",
  tier: 1,
  version: packageVersion("camelcase-keys"),
};
