import type { SizeLimitConfig } from "size-limit";

import { readFileSync } from "node:fs";

/*
 * A budget for every public entry, keyed by its subpath.
 *
 * - Sizes are the ESM entry bundled with its imports, then brotli-compressed.
 *
 * - An entry missing from this table fails `pnpm size`, so a new function
 *   can't ship without a budget.
 */
const limitsBySubpath: Record<string, string> = {
  ".": "100 B",
  "./is-placeholder": "100 B",
};

type EntryExports = Record<string, { import: { default: string } } | string>;

const packageJson = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf8")
) as { exports: EntryExports };

const config: SizeLimitConfig = Object.entries(packageJson.exports)
  .filter(([subpath]) => subpath !== "./package.json")
  .map(([subpath, target]) => {
    const limit = limitsBySubpath[subpath];

    if (limit === undefined || typeof target === "string") {
      throw new Error(
        `No size budget in size-limit.config.ts for "${subpath}"`
      );
    }

    return { limit, name: subpath, path: target.import.default };
  });

export default config;
