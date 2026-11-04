import snakecaseKeys from "snakecase-keys";

import type { Tool } from "./tool.mts";

import { keysProbe, packageVersion } from "./tool.mts";

/** The value type snakecase-keys declares, which a case's value is cast to. */
type SnakecaseKeysInput = Parameters<typeof snakecaseKeys>[0];

/** snakecase-keys, which converts an object's keys to snake case. */
export const SNAKECASE_KEYS: Tool = {
  functions: {
    snakeCaseKeys: [
      keysProbe({
        call: "snakecaseKeys(value)",
        convert: (value) => snakecaseKeys(value as SnakecaseKeysInput),
      }),
      keysProbe({
        call: "snakecaseKeys(value, { deep: false })",
        convert: (value) =>
          snakecaseKeys(value as SnakecaseKeysInput, { deep: false }),
        isShallow: true,
      }),
    ],
  },
  name: "snakecase-keys",
  tier: 1,
  version: packageVersion("snakecase-keys"),
};
