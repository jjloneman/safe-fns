import type { Config } from "prettier";

const CONFIG: Config = {
  overrides: [
    /*
     * The git hooks are POSIX shell scripts with no extension, so Prettier
     * can't infer a parser from the filename.
     *
     * - Matched by `!(*.*)` (extensionless files only) rather than
     *   `.githooks/*`, so a non-shell file added later (a `.githooks/README.md`)
     *   keeps its own inferred parser instead of being mangled as shell.
     */
    {
      files: ".githooks/!(*.*)",
      options: { parser: "sh" },
    },

    /*
     * JSONC files are hand-edited, so keep them free of the trailing commas
     * the es5 default would add.
     *
     * - `tsconfig.json` is listed by name because Prettier parses it as JSONC
     *   despite the `.json` extension.
     */
    {
      files: ["*.jsonc", "tsconfig.json"],
      options: { trailingComma: "none" },
    },

    /*
     * The research docs wrap prose at 80 columns, like the code beside them.
     *
     * - Markdown joins wrapped lines back into one paragraph, so the rendered
     *   page is unchanged; tables and code blocks never wrap.
     */
    {
      files: "research/**/*.md",
      options: { proseWrap: "always" },
    },
  ],
  plugins: [
    "@prettier/plugin-php",
    "@prettier/plugin-xml",
    "prettier-plugin-java",
    "prettier-plugin-packagejson",
    "prettier-plugin-sh",
    "prettier-plugin-toml",
  ],
  trailingComma: "es5",
};

export default CONFIG;
