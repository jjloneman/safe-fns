import type { Linter } from "eslint";

import jsPlugin from "@eslint/js";
import jsoncPlugin from "eslint-plugin-jsonc";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import tsdocPlugin from "eslint-plugin-tsdoc";
import ymlPlugin from "eslint-plugin-yml";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import path from "node:path";
import { configs as tsConfigs } from "typescript-eslint";

import { noDottedJsdocParam } from "./eslint-rules/no-dotted-jsdoc-param";

const config: Linter.Config[] = defineConfig(
  /*
   * ESLint doesn't read `.gitignore` on its own, so load it — one list of
   * ignored paths, which can't drift from git's.
   *
   * - Without it, `eslint .` lints gitignored dotfiles such as a per-user
   *   `.vscode/settings.json`, and `lint:fix` rewrites them.
   */
  includeIgnoreFile(path.resolve(import.meta.dirname, ".gitignore")),

  // Tracked, but generated: pnpm rewrites the lockfile on every install.
  globalIgnores(["pnpm-lock.yaml"]),

  /*
   * TypeScript, with the full typed presets.
   *
   * - Every linted file must belong to a project, and the project service
   *   resolves one only by walking up to the nearest config named exactly
   *   `tsconfig.json` — so a new top-level directory of `.ts` files must be
   *   added to that config's `include`, or linting it errors.
   *
   * - Typed rules make a file's verdict depend on the types it imports, which
   *   `.eslintcache` can't see: a file whose own content is unchanged is served
   *   from the cache even when an imported type changed underneath it. Delete
   *   `.eslintcache` when a local result looks impossible.
   *
   * - Scoped by `files` through `extends`, so no JS or typed rule ever runs
   *   against the JSON and YAML files below.
   */
  {
    extends: [
      jsPlugin.configs.recommended,
      tsConfigs.strictTypeChecked,
      tsConfigs.stylisticTypeChecked,
    ],
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      local: { rules: { "no-dotted-jsdoc-param": noDottedJsdocParam } },
      perfectionist: perfectionistPlugin,
      tsdoc: tsdocPlugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports", prefer: "type-imports" },
      ],

      /*
       * A boolean variable or parameter reads as a question: `isEmpty`,
       * `hasKey`, `shouldTrim`.
       *
       * - Destructured bindings are exempt, since their name is the source
       *   object's key and renaming it at the binding site only hides that.
       */
      "@typescript-eslint/naming-convention": [
        "error",
        {
          format: ["PascalCase"],
          prefix: ["can", "has", "is", "should"],
          selector: ["parameter", "variable"],
          types: ["boolean"],
        },
        {
          format: null,
          modifiers: ["destructured"],
          selector: ["parameter", "variable"],
        },
      ],

      // A brace-less guard reads fine until a second statement is added to it,
      // at which point that one runs unconditionally.
      curly: ["error", "all"],

      /*
       * A dotted `@param options.key` reaches no editor tooltip.
       *
       * - A local rule rather than a `no-restricted-syntax` selector, because
       *   a doc block is a comment, not an AST node a selector can reach.
       */
      "local/no-dotted-jsdoc-param": "error",

      // `Boolean(value)` over `!!value`, `Number(value)` over `+value`, and
      // `String(value)` over `"" + value`; autofixable.
      "no-implicit-coercion": "error",

      // Rewrite as a named helper whose guards read top to bottom, or a lookup
      // keyed by the discriminant.
      "no-nested-ternary": "error",

      "object-shorthand": ["error", "always"],

      /*
       * Lexicographic, case-insensitive ordering of imports, exports, object
       * keys, and type members.
       *
       * - Picked rule by rule rather than from a preset, which would also
       *   reorder classes, unions, and whole module members.
       */
      "perfectionist/sort-exports": "error",
      "perfectionist/sort-imports": "error",
      "perfectionist/sort-interfaces": "error",
      "perfectionist/sort-named-exports": "error",
      "perfectionist/sort-named-imports": "error",
      "perfectionist/sort-object-types": "error",
      "perfectionist/sort-objects": "error",

      "tsdoc/syntax": "error",
    },
    settings: {
      perfectionist: { ignoreCase: true, order: "asc", type: "alphabetical" },
    },
  },

  /*
   * JSON keys stay alphabetized, like object keys in TypeScript.
   *
   * - `package.json` is excluded: it keeps the conventional `sort-package-json`
   *   order, which `prettier-plugin-packagejson` enforces instead.
   *
   * - `tsconfig.json` is JSONC — TypeScript reads comments in it — so it gets
   *   the JSONC preset, which allows them.
   */
  {
    extends: [jsoncPlugin.configs["flat/recommended-with-json"]],
    files: ["**/*.json"],
    ignores: ["**/package.json", "**/tsconfig.json"],
  },
  {
    extends: [jsoncPlugin.configs["flat/recommended-with-jsonc"]],
    files: ["**/*.jsonc", "**/tsconfig.json"],
  },
  {
    extends: [jsoncPlugin.configs["flat/prettier"]],
    files: ["**/*.json", "**/*.jsonc"],
    ignores: ["**/package.json"],
    rules: {
      "jsonc/sort-keys": ["error", "asc", { caseSensitive: false }],
    },
  },

  // YAML keys stay alphabetized too; `flat/prettier` defers formatting to
  // Prettier.
  {
    extends: [
      ymlPlugin.configs["flat/recommended"],
      ymlPlugin.configs["flat/prettier"],
    ],
    files: ["**/*.yaml", "**/*.yml"],
    rules: {
      "yml/sort-keys": ["error", "asc", { caseSensitive: false }],
    },
  }
);

export default config;
