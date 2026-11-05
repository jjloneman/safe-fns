import snakecaseKeys from "snakecase-keys";

import type { Tool } from "./tool.mts";

import { excludeKeysProbe, keysProbe, packageVersion } from "./tool.mts";

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
      excludeKeysProbe({
        call: "snakecaseKeys(value, { exclude })",
        convert: (value, exclude) =>
          snakecaseKeys(value as SnakecaseKeysInput, { exclude }),
      }),
    ],
  },
  name: "snakecase-keys",
  tier: 1,
  version: packageVersion("snakecase-keys"),
};
