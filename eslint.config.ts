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

/**
 * One `yml/sort-keys` option: the mappings whose path matches `pathPattern`
 * list `keys` first, in that order, then any other key alphabetized.
 *
 * @returns the rule option.
 */
function documentedOrder({
  keys,
  pathPattern,
}: {
  /** The keys whose order carries meaning, in that order. */
  keys: readonly string[];

  /**
   * A regex source matched against a mapping's path, such as
   * `jobs.lint.steps[0]`; the root mapping's path is empty.
   */
  pathPattern: string;
}): {
  order: ({ order: { caseSensitive: boolean; type: "asc" } } | string)[];
  pathPattern: string;
} {
  return {
    order: [...keys, { order: { caseSensitive: false, type: "asc" } }],
    pathPattern,
  };
}

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
      perfectionistPlugin.configs["recommended-alphabetical"],
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
      tsdoc: tsdocPlugin,
    },
    rules: {
      // The stylistic preset defaults to `interface`; the repo prefers `type`.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

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

      /*
       * Numbers interpolate safely; the rule's worth is catching `undefined`,
       * `null`, and `[object Object]` slipping into a string.
       *
       * - Without this, every number in a template needs a `String()` wrapper
       *   that changes nothing: `${count}` reads the same as
       *   `${String(count)}` and prints the same.
       */
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
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

      // A named group says what it captured; `match[2]` makes the reader
      // count parentheses.
      "prefer-named-capture-group": "error",

      "tsdoc/syntax": "error",
    },
    /*
     * Every perfectionist rule sorts case-insensitively, so `fallback` sorts
     * before `Options`.
     *
     * - Where an order carries meaning (a `Set`'s iteration order, a module
     *   read top to bottom), disable the rule on that line with a comment
     *   saying why, rather than turning it off here.
     */
    settings: {
      perfectionist: { ignoreCase: true },
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
  },

  /*
   * GitHub's YAML files read in their documented order instead: a workflow
   * opens with `name` and `on`, a step with `name` and `uses`.
   *
   * - Each mapping lists its well-known keys first, in that order; any other
   *   key follows, alphabetized.
   *
   * - The first `pathPattern` matching a mapping's path wins, so the
   *   alphabetical fallback comes last.
   */
  {
    files: [".github/**/*.yml"],
    rules: {
      "yml/sort-keys": [
        "error",
        // A workflow's, an action's, or dependabot.yml's top level.
        documentedOrder({
          keys: [
            "name",
            "description",
            "on",
            "inputs",
            "outputs",
            "concurrency",
            "permissions",
            "env",
            "defaults",
            "jobs",
            "runs",
            "version",
            "updates",
          ],
          pathPattern: "^$",
        }),
        documentedOrder({
          keys: [
            "name",
            "if",
            "needs",
            "runs-on",
            "permissions",
            "strategy",
            "outputs",
            "env",
            "steps",
          ],
          pathPattern: String.raw`^jobs(?:\.[^.[]+|\[[^\]]+\])$`,
        }),
        documentedOrder({
          keys: ["name", "id", "if", "uses", "with", "env", "shell", "run"],
          pathPattern: String.raw`\.steps\[\d+\]$`,
        }),
        documentedOrder({ keys: ["using", "steps"], pathPattern: "^runs$" }),
        documentedOrder({
          keys: ["cron", "timezone"],
          pathPattern: String.raw`^on\.schedule\[\d+\]$`,
        }),
        documentedOrder({
          keys: ["package-ecosystem", "directory", "directories", "schedule"],
          pathPattern: String.raw`^updates\[\d+\]$`,
        }),
        documentedOrder({
          keys: ["interval", "day", "time", "timezone"],
          pathPattern: String.raw`^updates\[\d+\]\.schedule$`,
        }),
        documentedOrder({ keys: [], pathPattern: ".*" }),
      ],
    },
  },

  /*
   * Issue forms and the template chooser follow GitHub's documented order too.
   *
   * - After `name` and `description`, a form's keys differ from a workflow's,
   *   so this block replaces the options above rather than widening them.
   */
  {
    files: [".github/ISSUE_TEMPLATE/*.yml"],
    rules: {
      "yml/sort-keys": [
        "error",
        documentedOrder({
          keys: [
            "name",
            "description",
            "title",
            "labels",
            "assignees",
            "blank_issues_enabled",
            "contact_links",
            "body",
          ],
          pathPattern: "^$",
        }),
        documentedOrder({
          keys: ["type", "id", "attributes", "validations"],
          pathPattern: String.raw`^body\[\d+\]$`,
        }),
        documentedOrder({
          keys: [
            "label",
            "description",
            "placeholder",
            "value",
            "render",
            "multiple",
            "options",
            "default",
          ],
          pathPattern: String.raw`^body\[\d+\]\.attributes$`,
        }),
        documentedOrder({
          keys: ["name", "url", "about"],
          pathPattern: String.raw`^contact_links\[\d+\]$`,
        }),
        documentedOrder({ keys: [], pathPattern: ".*" }),
      ],
    },
  }
);

export default config;
