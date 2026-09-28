import type { UserConfig } from "tsdown";

import { isDeepStrictEqual } from "node:util";
import { defineConfig } from "tsdown";

type EntryExport = Partial<Record<"import" | "require", string>>;

const declarationExtensions = { ".cjs": ".d.cts", ".js": ".d.ts" };

/**
 * Nest each `import`/`require` target under its own `types` condition.
 *
 * - tsdown emits the declarations but leaves them to be found beside the
 *   JavaScript; an explicit `types` first in each condition is what every
 *   resolver reads, including ones that don't probe for siblings.
 *
 * - Non-entry exports (`./package.json`) pass through unchanged.
 */
function addTypesConditions(
  generatedExports: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(generatedExports).map(([subpath, target]) => [
      subpath,
      typeof target === "string"
        ? target
        : Object.fromEntries(
            Object.entries(target as EntryExport).map(([condition, file]) => [
              condition,
              // Conditions match in order, so `types` must precede `default`.
              // eslint-disable-next-line perfectionist/sort-objects
              { types: toDeclarationPath(file), default: file },
            ])
          ),
    ])
  );
}

function toDeclarationPath(file: string): string {
  const [extension, declarationExtension] =
    Object.entries(declarationExtensions).find(([candidate]) =>
      file.endsWith(candidate)
    ) ?? [];

  if (extension === undefined || declarationExtension === undefined) {
    throw new Error(`No declaration extension known for ${file}`);
  }

  return `${file.slice(0, -extension.length)}${declarationExtension}`;
}

const config: UserConfig = defineConfig({
  clean: true,

  /*
   * Declarations come from tsc, not the faster Oxc generator that
   * `isolatedDeclarations` would otherwise select.
   *
   * - Oxc widens a `const` literal's type (`true` becomes `boolean`), so the
   *   published types would disagree with what the type tests check.
   */
  dts: { generator: "tsc" },

  /*
   * Every `src/*.ts` file is a public entry, so a new function gets its own
   * subpath without touching this config.
   *
   * - Tests sit beside the source, so they are excluded here; `*.test.ts` also
   *   covers `*.node.test.ts`.
   */
  entry: ["src/*.ts", "!src/*.test.ts", "!src/*.test-d.ts"],

  /*
   * tsdown writes `exports` (plus the legacy `main`, `module`, and `types`)
   * into `package.json` from the same entry list it builds.
   *
   * - Locally the build rewrites a stale map; in CI it fails instead, so a
   *   committed `package.json` can't drift from `src/`.
   */
  exports: {
    customExports(generatedExports, { pkg }) {
      const typedExports = addTypesConditions(generatedExports);

      if (
        process.env.CI !== undefined &&
        !isDeepStrictEqual(pkg.exports, typedExports)
      ) {
        throw new Error(
          "package.json `exports` is out of sync with src/; run `pnpm build` and commit the result."
        );
      }

      return typedExports;
    },
  },

  format: ["cjs", "esm"],
  minify: false,

  // The package must not assume Node or a browser.
  platform: "neutral",

  target: "es2022",

  // One output file per source file, so a subpath import loads only its own
  // function.
  unbundle: true,
});

export default config;
