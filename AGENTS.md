# 🤖 AGENTS.md

Conventions for any AI agent (or human) working in this repo. Read top to bottom before editing.

## 🎯 Purpose of this repo

`safe-fns` is a standalone, zero-dependency, strongly typed npm package of helpers that never throw — most take an `unknown` value and return a safe, typed result.

- **Every export is total**: it never throws; bad input returns a fallback the caller chooses, or a documented neutral result (`range` returns `[]`).
- It replaces helpers that were copy-pasted across several projects and had drifted apart.
- The roadmap and the reasoning behind the package live in the umbrella issue, [#1](https://github.com/jjloneman/safe-fns/issues/1).

## 🧭 Design principles

These bind every exported function. A change that breaks one is a bug, even if its tests pass.

- **Environment-independent.** A function returns the same result in Node, every browser, and any other JS runtime.
  - Never branch on `typeof window`, `process`, or any other environment probe.
  - A side-effecting export (storage, logging) runs the same code everywhere, but its result can depend on what the environment provides — `safeLocalStorageGetItem` returns the fallback where there's no `localStorage`; document it.
  - Where an engine genuinely differs (ICU data, non-ISO date parsing), document it rather than papering over it.
- **Never widen a narrow check.** A check matches exactly what its name says, identified by a reliable test (`Array.isArray`, a brand check) rather than by shape.
  - Don't duck-type: an object with a `length` or `size` key is not a collection, and `{ length: 0, name: "x" }` is not "empty".
  - Loosening a published check is a breaking change, never a drive-by.
- **Fail safe toward preserving data.** When a value can't be inspected safely, pick the answer that keeps it: an uninspectable value is "populated", not "empty".
- **Never throw.** Every export catches what it touches — getters, proxies, `toString`/`valueOf` traps, revoked proxies — and returns the caller's fallback instead.
- **Fast on the common path.** Match or beat the fastest competitor, measured by benchmark — but robustness beats speed.
  - Cheapest checks first (`typeof`, `=== null`), then built-in checks, then walking the value; no allocation or wrapper layers on the common case.
  - See [the decision](docs/decisions/performance.md).
- **No unreachable branches.** Coverage is 100%; a branch nothing can reach is dead code to delete, not a line to exempt.
- **Zero runtime dependencies.** `dependencies` and `peerDependencies` stay empty.
- **One function per file.** Each export lives in its own file under `src/`, so each gets its own subpath and its own output file.

## 🗂️ Project layout

- `src/` — library source.
  - `src/index.ts` is the root entry and re-exports every function.
  - Every other `src/*.ts` file is one function and one public subpath, named in kebab-case (`src/is-safe-empty.ts` → `safe-fns/is-safe-empty`).
  - Today the only one is the `src/is-placeholder.ts` placeholder, removed when the first real function lands.
  - Each function's tests sit beside it as `*.test.ts` and `*.test-d.ts`.
- `test/` — shared test harnesses, imported as `#test/*` (see [Testing](#-testing)).
  - `test/consumer/` — fixtures run by `pnpm test:consumer` against the packed tarball (see [Build & package](#-build--package)).
- `scripts/` — repo scripts, run directly by Node (which strips their types), so they stick to erasable TypeScript syntax.
  - Relative imports name the `.ts` file (`./lib/publish-ci-report.ts`), since Node resolves only the real file name.
  - Every console log line a script prints starts with `[<script-name>]` (e.g. `[okf-verify] …`), including each line of a multi-line message, so its output is traceable in a log; an interactive prompt's own UI is exempt.
  - A child process sets `stdio` explicitly; `execFileSync` inherits stderr by default, which leaks the child's messages into the terminal.
  - Readability beats a few ops/second here: nothing in `scripts/` is public API or a hot path, so `map` / `filter` / `reduce` are fine even where a plain loop would be faster.
  - An error message says only what the error shows — read its `code` or `stderr` rather than guessing a cause.
  - Dates and durations go through luxon, a dev dependency: a duration constant is `Duration.fromObject({ minutes: 15 })`, ending in `.toMillis()` only where an API takes milliseconds, and date math uses `DateTime` and `Duration` methods rather than hand-multiplied numbers.
  - `scripts/post-ci-timings.ts` is the exception: its CI job runs it before `pnpm install`, so it imports nothing outside Node.
  - `scripts/okf-verify.ts` is the interactive `pnpm okf:verify` flow, and `scripts/lib/okf-frontmatter.ts` holds the pure frontmatter functions it uses; `scripts/**/*.test.ts` runs in the `node` project.
  - `scripts/research/` is the comparison harness's host side: `run.ts` (`pnpm research`) orchestrates the containers, `usage-search.ts` (`pnpm research:usage`) queries GitHub's code search and npm, and `codec.ts`, `compose.ts`, `images.ts`, `inputs.ts`, `results.ts`, `sources.ts`, `tables.ts`, `usage-tally.ts`, `call-arguments.ts`, and `logging.ts` are the pure, tested parts.
- `research/` — the cross-language comparison harness (see [Research harness](#-research-harness)), outside `files`, so never published.
- `dist/` — build output (gitignored), the only directory published.
- `README.md` — the public face: why the package exists, install and usage, the API, the support matrix, scripts, and what each label means.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` — the community-health files.
  - `CONTRIBUTING.md` links to this file's sections rather than repeating them, so each convention changes in one place only.
  - Security reports go through GitHub private vulnerability reporting.
- `.githooks/` — the pre-commit and pre-push hooks (see [Pre-commit checks](#-pre-commit-checks)).
- `.github/workflows/` — CI, CodeQL, release, and the two research workflows (see [CI](#-ci)); `.github/actions/setup/` is the shared pnpm + Node + install prelude.
- `.github/renovate.json5` — Renovate's weekly dependency updates for npm, GitHub Actions, and the research harness, run by `.github/workflows/renovate.yml` (see [CI](#-ci)).
- `.github/ISSUE_TEMPLATE/` — YAML issue forms (🐞 bug, ✨ feature, 🤔 semantics question, 🤝 conduct report), each labeled `📥 needs-triage`, plus `config.yml`, which disables blank issues.
- `.github/PULL_REQUEST_TEMPLATE.md` — summary, `Closes #`, verification, and a checklist.
- `.github/rulesets/` — the repository rulesets that protect `main` (see [Issues & PRs](#️-issues--prs)).
- `.vscode/extensions.json` — the editor extensions VS Code offers to install, one per tool or file type the repo uses, each with a comment saying why; `.vscode/settings.json` stays per-user and gitignored.
- `assets/` — the brand files, outside `files`, so never published.
  - The mark (`logo-light.svg`, `logo-dark.svg`) and the mark-plus-name lockup (`logo-wordmark-light.svg`, `logo-wordmark-dark.svg`), each cropped tight to its shapes.
  - The lockup's lettering is Inter Bold, outlined to paths so it renders without the font.
  - A theme-aware `favicon.svg`, and the 1280×640 `social-preview.png` for the repo's link previews, rendered from `social-preview.svg`.
  - The README loads the logos by absolute `raw.githubusercontent.com` URL, since npm can't resolve repo-relative images.
- `docs/decisions/` — the design-decision bundle (see [Design decisions](#-design-decisions)).
- `eslint-rules/` — local ESLint rules, loaded by `eslint.config.ts`.
- `eslint.config.ts` — ESLint flat config.
  - TypeScript gets the full typed presets (`strictTypeChecked` + `stylisticTypeChecked`), perfectionist's `recommended-alphabetical` ordering, and `tsdoc/syntax`.
  - JSON and YAML get `jsonc/sort-keys` and `yml/sort-keys`; `package.json` is excluded and keeps the `sort-package-json` order through `prettier-plugin-packagejson`.
  - YAML under `.github/` follows GitHub's documented key order instead (`name`, `on`, … `jobs`), with any other key alphabetized after it.
  - An issue form opens with `name`, `description`, `title`, and `labels`; the rest of it is alphabetized.
- `prettier.config.ts` — Prettier defaults plus `trailingComma: "es5"`, the `package.json` sorter, and a shell parser for `.githooks/`.
- `release-please-config.json` and `.release-please-manifest.json` — release-please's config and the last released version (see [Versioning & releases](#-versioning--releases)).
- `size-limit.config.ts` — the size budget for every public entry.
- `tsdown.config.ts` — the build, and the generated `exports` map in `package.json`.
- `tsconfig.json` — one root covering `src`, `test`, `scripts`, `eslint-rules`, and the root-level `*.config.ts` files.
  - `paths` maps `safe-fns` and `safe-fns/*` to `src/`, so `test/consumer/` typechecks and lints before any build.
  - An editor and ESLint's project service both resolve a file by walking up to the nearest config named exactly `tsconfig.json`, so every TypeScript file must fall inside this root's `include`.
  - Don't add a differently named config (`tsconfig.eslint.json`, …) to cover a directory; it typechecks in CI while leaving the editor and the linter blind.
  - The one exception is a separately installed package with its own `node_modules`: it gets a nested config, still named exactly `tsconfig.json`, that extends the root's — today only `research/tsconfig.json`.
- `vitest.config.ts` — the `node` and `jsdom` test projects and the coverage gate.

## 🎨 Code style guidelines

### 🏛️ Architecture & design mindset

- **Think holistically, like an architect.** Weigh each change against the whole package — where a responsibility should live, what a module's boundaries are — not just the file in front of you.
- **But don't over-architect.** No speculative abstraction, factories, or config layers a single call site doesn't justify. The simplest design that keeps concerns separated wins.
- **Watch for god files and god functions.** When one starts accreting unrelated responsibilities, split it rather than piling on.
- **Semantic naming everywhere.** Files, types, functions, and params say what the thing is or does. Avoid vague names (`data`, `tmp`, `obj`) except where scope is trivial.
- **American English in all prose** — comments, TSDoc, test names, docs, commit messages, and issue/PR bodies (`color`, `behavior`, `-ize`).
  - Identifiers and third-party APIs keep whatever spelling they already have.

### 🌐 Every language

The conventions below are written for TypeScript, but they bind code in every language — Python, shell, SQL, Groovy, and whatever comes next.

- **Same shape everywhere:** semantic names, lexicographic ordering, 80-column lines, a doc comment on every function, no nested ternaries, and the blank-line padding described under [Code shape](#-code-shape).
- **Types as strong as the language allows** wherever they can't be inferred: Python annotations and `TypedDict`s, Groovy's declared types and `@CompileStatic`.
- **Immutable by default:** a binding that is never reassigned says so — `const` in TypeScript, `val` in Kotlin, and `final` on Java parameters, catch parameters, and locals.
- **A block for every `if`, `for`, and `while`**, even where the language allows a one-line form; Python's `x if y else z` is the one accepted inline conditional.
  - Ruby is the exception: syntax_tree, its formatter, rewrites a short block into modifier form (`return x if y`) and has no setting to stop it, so its output stands.
- **Keyword or named arguments** wherever the language has them, mirroring the single-object rule below: in Python, a function with two or more parameters makes them keyword-only (`def run_probe(*, args, probe)`).
- **Enforce what a tool can:** each language's formatter and linter is configured to these rules (for Python, `research/ruff.toml`; for Java, `research/adapters/jvm/checkstyle.xml`), and the rest is applied by hand.

### 🔷 TypeScript

- **Strict types**: no `any`. Let inference work where an annotation would be redundant.
  - Exported functions always declare their return type — `isolatedDeclarations` enforces it.
- **A `catch` binding is `unknown`; narrow it, don't cast it.** Read the fields you need with `instanceof` and `typeof` checks in a small helper, rather than `error as SomeShape`.
- **Avoid `as unknown as T`.** Prefer `satisfies`; when a full `T` isn't practical (e.g. a test stub), assert through a `Partial` first: `({ … }) satisfies Partial<T> as T`.
- **Derive types from existing types** (`Options["fallback"]`, `Pick<…>`, indexed access) rather than re-spelling a primitive, so a change propagates through tsc instead of drifting.
- **Name object types rather than writing them inline** — a param, return, or options shape gets a named `type` whose properties carry TSDoc, built with `Pick<…>` from an existing type where one overlaps.
- **A field with a known, finite set of values is a literal union**, not `string` — derived from an `as const` object.
  - Narrow untrusted input (file contents, CLI args, JSON) once, at the boundary where it's parsed, with a type guard.
  - A value outside the set reads as absent; never cast it into the union.
- **`type` over `interface`** — use `interface` only when declaration merging is genuinely needed.
- **`import type`** for type-only imports (`verbatimModuleSyntax` enforces it).
- **`as const` objects over `enum`s**, paired with `(typeof OBJ)[keyof typeof OBJ]` for the union type.

### 🧱 Code shape

- **Lexicographic ordering**: everything perfectionist's `recommended-alphabetical` preset can sort stays alphabetized.
  - That covers object keys, type members, imports and exports, union and intersection members, `Set`/`Map`/array-`includes` entries, switch cases, class members, and a module's top-level declarations.
  - Where an order carries meaning, disable the rule on that line with an `eslint-disable-next-line` comment saying why, rather than turning it off in the config.
  - Ordering is case-insensitive unless a tool says otherwise — `fallback` sorts before `Options`.
- **Function parameters** depend on who calls the function.
  - **Public API** (an export of `src/`): the one or two values a function works on are positional (`isSafePopulated(value)`, `isDeepEqual(a, b)`); configuration goes in a trailing options object, even with one key. More than two values go in one object with sorted keys, a function that wraps a native API keeps the native values in their native order but takes the native call's optional configuration (`replacer`, `space`) in its options object, and nothing is variadic — see [the decision](docs/decisions/function-parameters.md).
  - **Internal code** (`scripts/`, and helpers no consumer imports): one positional parameter is fine; with two or more, take a single object with sorted keys, which reads clearly at the call site (`verifyRecord({ at, text, verifiedBy })`) and survives adding or reordering a parameter.
- **Group independent declarations in lexicographic order** — module constants, function declarations, and runs of `const`s in a function body, wherever none depends on another being declared first.
  - A script's entry point (`main`) is the exception: it goes last, just above the call that runs it. `eslint.config.ts` gives `sort-modules` a `main` group after every other function for `scripts/`, so lint enforces it.
  - perfectionist's `sort-modules` enforces the order of module-level functions and types, not of constants; `const` runs are kept sorted by hand.
- **Module-level constants are `SCREAMING_SNAKE_CASE`** (`BASE_BRANCH`, `RECORD_STATUSES`), including one computed once at startup and never reassigned; locals stay camelCase.
  - ESLint's `naming-convention` enforces it, exempting destructured bindings, which keep their source key's name.
  - A boolean constant is the exception: it keeps the question form (`isPlaceholder`), since the boolean-prefix rule outranks this one.
  - A module-level function is a `function` declaration (see the next bullet), so the rule never reaches it and it keeps its camelCase name.
  - A name that must shadow a global (`const require = createRequire(…)`) keeps it, with an `eslint-disable-next-line` comment saying why.
- **Named functions are `function` declarations; arrows are for functions defined inside another.**
  - A module-level function, exported or not, is `function name(…)`, never `const name = (…) => …`.
  - Its `.d.ts` reads `declare function`, so editors and documentation tools show a public export as a function, not a variable.
  - It can take overload signatures, which an arrow bound to a constant can't without a separate call-signature type.
  - perfectionist's `sort-modules` sorts declarations only, and any `const` splits its sorted runs, so only a declaration gets alphabetized and the `main`-last rule.
  - Arrows stay the default inside a function: callbacks, closures, a returned function (`return (value) => …` for currying), and `reduce` reducers.
  - To tie a declaration to an existing function type, derive its parameter types (`file: Parameters<ReadDockerfile>[0]`) rather than binding an arrow to the type.
  - Stack traces don't decide it: an arrow bound to a `const` is named after it anyway; only an inline or returned function shows as anonymous, whichever syntax it uses.
- **Build fixed lookup data once, outside the function** — a membership check against a known set of values is a module-level `Set` and `.has(value)`, not an array rebuilt and searched on every call.
- **Named imports over a namespace import** — `import { confirm, select } from "…"`, not `import * as prompts`.
- **Give multi-line statements breathing room**: a blank line separates a statement that spans several lines from its neighbors, and a TSDoc'd declaration from the one above it.
- **Prefer functional over imperative** — `map`/`filter`/`reduce` and pure helpers over mutable loops, unless the loop is genuinely clearer.
  - Where speed matters (a public export), a benchmark decides; in `scripts/`, readability wins, so take the functional form even when a loop is a little faster.
  - When `reduce` builds an object or array, **mutate the accumulator** and return it, rather than spreading a fresh copy on every iteration — a spread per item turns a linear pass quadratic.
  - This is safe only because the accumulator is the `reduce`'s own initial value; never mutate a seed object the caller passed in.
  - **Name the accumulator for what it holds** (`countsByType`, `keysByLength`), never `acc` or `accumulator`.

  ```ts
  const typeCounts = values.reduce<Record<string, number>>(
    (countsByType, value) => {
      const valueType = typeof value;
      countsByType[valueType] = (countsByType[valueType] ?? 0) + 1;

      return countsByType;
    },
    {}
  );
  ```

- **Boolean variables and parameters read as questions** — `isEmpty`, `hasKey`, `shouldTrim` — with a `can`, `has`, `is`, or `should` prefix. Destructured bindings keep their source key's name.
- **Prefer `??` and `?.`** over `||` and `&&` chains when the intent is "fall back if nullish". Keep `||` only when every falsy value should trigger the fallback.
- **Coerce with the constructor, not an operator** — `Boolean(value)` not `!!value`, `Number(value)` not `+value`, `String(value)` not `"" + value`.
  - A number interpolates into a template literal as-is (`${count}`); anything else non-string needs an explicit `String()`, which `restrict-template-expressions` enforces.
  - Inside a library function, remember that the constructors themselves can throw on hostile input — guard them per the design principles.
- **No nested ternaries.** Use a named helper whose guards read top to bottom, or a lookup keyed by the discriminant.
- **Property access**: dot notation for valid identifiers; brackets only for dynamic or special-character keys.
- **Array access**: `.at(-1)` for the last element only — briefer and cleaner than `array[array.length - 1]`; plain `array[i]` everywhere else.
- **Strings**: template literals over concatenation.
- **Regexes use named capture groups** — `(?<objectName>…)`, read through `match.groups`, never a positional `match[2]`.
  - A group whose text isn't read is non-capturing, `(?:…)`.
  - Enforced by ESLint's `prefer-named-capture-group`.
- **Build a repeated regex fragment once.** When the same sequence recurs across patterns, name it as a `String.raw` constant (`QUOTE`, `TIMESTAMP`) or a small builder function, and compose the patterns from it.
- **Unicode property escapes are welcome where they say more** — `\p{Letter}`, `\P{White_Space}`, `\p{Script=Latin}`, with the `u` or `v` flag.
  - Use them when they match the intent better than a hand-written class; don't swap one in where the format is narrower (YAML quotes are only `"` and `'`, not `\p{Quotation_Mark}`).

### 💬 Comments and TSDoc

- **Comment only _why_** — non-obvious constraints, workarounds, invariants. Never restate what the code does, and never reference current tasks, PRs, or callers; those rot.
  - Tests are the exception: each test body uses `// Given` / `// When` / `// Then` section comments, with `// And` to continue the previous phase, each followed by a hyphen and a short description (`// When - verifying it`).
  - `// Setup` and `// Cleanup` mark setup or teardown that belongs to one specific test rather than a shared hook.
- **Comment shape: lead sentence, then bullets.**
  - A comment of three lines or more uses the block form (`/* … */`, or `/** … */` for TSDoc), not stacked `//` lines.
  - The first sentence is prose; every following point is a `-` bullet, and a blank line always separates the sentence from the bullets.
  - When every bullet fits on one line, the bullets can sit together; once any bullet wraps, put a blank line between all of them.
  - One- and two-line comments stay a plain `//`.

  ```ts
  /**
   * Resolve the fallback a parser returns for input it can't read.
   *
   * - Defaults to `undefined`, so a caller who passes nothing can still tell
   *   "missing" from a real value.
   *
   * - Never invoked lazily — a fallback is a value, not a thunk.
   *
   * @returns the caller's fallback, or `undefined`.
   */
  ```

- **Doc comments follow [TSDoc](https://tsdoc.org)**, TypeScript's standardization of JSDoc-style comments.
  - The familiar tags carry over (`@param`, `@returns`, `@example`, `@deprecated`), but TSDoc drops JSDoc's `{type}` annotations — the types come from TypeScript — and writes `@param name - description` with a hyphen.
- **TSDoc every export** — functions, constants, objects, types, and classes alike: a one-line summary plus `@returns` where it applies, and `@example` where a value clarifies. Document the contract and invariants, not the implementation.
- **`@param` is for positional params only.** An object param documents each key on the **property in its type literal**, where the editor's tooltip actually reads it. `@param options.fallback` is invisible to IntelliSense.
- **Lint enforces the TSDoc rules it can**: `tsdoc/syntax` rejects malformed or unknown tags, and the local `no-dotted-jsdoc-param` rule rejects a dotted `@param`.

  ```ts
  /**
   * Parse a value into a finite number.
   *
   * @returns the parsed number, or the caller's fallback.
   */
  export function safeParseNumber<F = undefined>(
    value: unknown,
    options?: {
      /** The value returned when `value` can't be parsed. */
      fallback?: F;
    },
  ): number | F {
  ```

- **A short TSDoc is one line** — a doc that is just a sentence is written `/** … */` on a single line; it opens up only for bullets or tags.
- **Every documented type property carries one `@example`** with a representative value.
  - Keep the value on the `@example` line. `tsdoc/syntax` rejects a bare backslash or brace there, so wrap such a value in a code span: `` @example `"\n"` ``.
- **Blank line between TSDoc'd members.** When each property of a type carries its own doc comment, separate them with a blank line. Undocumented members can stay packed.

## ✍️ Commit conventions

[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) with a gitmoji after the colon:

```text
<type>(scope): <gitmoji> <subject>
```

| Type       | Gitmoji | Use for                            |
| ---------- | ------- | ---------------------------------- |
| `build`    | 🔨      | build system / typecheck infra     |
| `chore`    | 🧹 / ⬆️ | housekeeping, dependency bumps     |
| `ci`       | 🤖      | CI / Renovate / workflow changes   |
| `config`   | 🔧      | tooling config (eslint, vitest, …) |
| `docs`     | 📝      | documentation                      |
| `feat`     | ✨      | new feature                        |
| `fix`      | 🔧      | bug fix                            |
| `perf`     | ⚡️      | performance                        |
| `refactor` | 🏗️      | refactor                           |
| `test`     | 🧪      | tests                              |

- **Scope** is the area touched — a function name, or `repo`, `package`, `lint`, `workflow`, `deps`, etc.
- **Subject** is imperative, lowercase, with no trailing period.
- **Body**, when needed, is `-` bullet points, not prose paragraphs.
- **Dependency bumps**: `chore(deps): ⬆️ bump <package> from X to Y` (`chore(deps-dev): ⬆️ …` for dev dependencies).
- **The `research` scope takes 🔬** in place of its type's gitmoji: `chore(research): 🔬 …`, `ci(research): 🔬 …`, `docs(research): 🔬 …`.
  - The type still decides the release; release-please hides `chore`, `ci`, and `docs`.
- **A change that adds or updates a development script under `scripts/` takes 🔨**, gitmoji's "add or update development scripts", whatever its type (`chore(okf): 🔨 add an interactive okf:verify script`).
- Renovate writes the same `chore(deps-dev): ⬆️ bump …` and `chore(actions): ⬆️ bump …` subjects, set in `.github/renovate.json5`.

### 🌿 Branch naming

- Prefixes: `feature/`, `bugfix/`, `release/`.
- When tied to an issue, insert `gh-<n>-` after the prefix, then a short kebab-case description — e.g. `feature/gh-12-add-safe-parse-number`.
- Almost every branch should be tied to an issue; file one first rather than branching without it.
- Only in the rare branch without an issue, drop the `gh-<n>-` segment.

### 🏷️ Issues & PRs

- **Assign** issues and PRs to the repo owner (`jjloneman`).
- **Type label**: `✨ feature` for features, `🐞 bug` for bugfixes, `📦 dependencies` for dependency-only PRs.
- **Area label** where one fits (`area: 🛠️ tooling`, `area: 📝 docs`, …).
- Label names carry an emoji prefix, so spell them exactly (`gh issue create --label "✨ feature"`).
- Apply the same labels to an issue and its matching PR.
- PRs are **squash-merged**, so the PR title becomes the commit on `main` — keep it in the commit format above.
- **`main` is protected** by the ruleset in [.github/rulesets/main.json](.github/rulesets/main.json), with no bypass for anyone:
  - every change lands through a PR, squash-merged, and unresolved review threads block the merge;
  - no force pushes, no deletion, and linear history only.
- **The ruleset file is the source of truth** — after editing it, reapply it with `gh api --method PUT repos/jjloneman/safe-fns/rulesets/<id> --input .github/rulesets/main.json` (`gh api repos/jjloneman/safe-fns/rulesets` lists the id).
- **AI-written text on GitHub opens with a disclaimer banner.** Any issue body, PR body, or comment an AI agent writes begins with this line, then a blank line:

  ```md
  > **🤖 Disclaimer**: This description was generated with AI. (**Model**: _<model name and version>_)
  ```

  - Use "description" for an issue or PR body, and "comment" for a comment.
  - Name the model that actually wrote the text, by its human-readable name and version, not its raw API id.
  - Never add the banner to text a human wrote.

## 🧪 Testing

- `pnpm test` runs the suite once; `pnpm test:watch` reruns it on change; `pnpm test:coverage` adds the coverage gate.
- **Two projects run the same tests:**
  - `node` — also runs `*.node.test.ts` (Node built-ins such as `node:vm`) and the `*.test-d.ts` type tests;
  - `jsdom` — a DOM-shaped environment, standing in for a browser until real-browser runs exist.
- **Coverage must be 100%** on statements, branches, functions, and lines across `src/`, or `pnpm test:coverage` fails.
  - Untested files count against the total rather than dropping out of the report.
  - Reports land in `coverage/` (gitignored).
- **Every export plugs into two harnesses in `test/`:**
  - `cross-env.cases.ts` — a table of calls and expected results, run unchanged by both projects;
  - `hostile-inputs.ts` (plus the Node-only `cross-realm-inputs.ts`) — values that trap on inspection, for proving an export never throws.
- `scripts/research/*.test.ts` covers the research harness's codec, Compose arguments and output, merging, sources, and tables, and the usage script's call scanner and tallies, and checks its image pins (no pre-release, Renovate's Python holds, one group for `research/`); it runs in the `node` project, outside the `src/` coverage gate, but is kept at 100% too.
- How to write a test is covered by `.claude/rules/testing.md`.

## 📦 Build & package

- `pnpm build` runs tsdown: ESM (`.js`) and CJS (`.cjs`) with `.d.ts`/`.d.cts`, one unbundled, unminified file per `src/*.ts` entry, target ES2022.
  - Tests beside the source are excluded from the entry glob, so they never reach `dist/`.
  - Declarations come from tsc, not Oxc: Oxc widens a `const` literal's type (`true` → `boolean`).
- **`exports` in `package.json` is generated**, along with the legacy `main`, `module`, and `types`.
  - The build rewrites it from the entry list, adding a `types` condition first under each `import`/`require`; commit the result.
  - With `CI` set, a stale map fails the build instead of being rewritten.
  - `typesVersions` is a static wildcard (`./dist/*.d.ts`, then `./*` for the root's own `types`), so subpaths resolve under `moduleResolution: "node"` with nothing to regenerate.
- `pnpm lint:package` builds, then runs publint and `attw --pack` (Are the Types Wrong).
- `pnpm size` builds, then checks each entry against its budget in `size-limit.config.ts` (passed by `--config`, since size-limit only finds `.size-limit.*` on its own); an entry without a budget fails.
- `pnpm test:consumer` builds, packs, and installs the tarball into a scratch project, then:
  - fails if the tarball holds a test file;
  - typechecks `test/consumer/types.ts` against every supported consumer TypeScript version;
  - loads every entry via `import` and `require` with `test/consumer/smoke.ts`, and checks the root re-exports each subpath.
- **Consumer TypeScript support is 4.9+.**

  | TypeScript       | `node10` | `node16` (CJS + ESM) | `bundler` |
  | ---------------- | :------: | :------------------: | :-------: |
  | 4.9              |    ✅    |          ✅          |     —     |
  | 5.0, 5.4, 5.9    |    ✅    |          ✅          |    ✅     |
  | 6.0 (the repo's) |    ✅    |          ✅          |    ✅     |
  | 7.0              |    —     |          ✅          |    ✅     |
  - The older compilers are dev-dependency aliases (`typescript-4.9`, …), used only by `test:consumer`.
  - Public types must avoid syntax TS 4.9 can't parse, such as `const` type parameters and `NoInfer`.
  - When a function is added or the placeholder removed, update `test/consumer/types.ts` to import it.

## ✅ Pre-commit checks

- Run `pnpm check` before committing; it must pass.
  - It runs `lint:fix`, then `format`, then `typecheck`, so it rewrites files; read the diff after.
  - `pnpm lint` and `pnpm format:check` are the read-only versions.
- Git hooks back this up, installed by `pnpm install` (the `prepare` script points `core.hooksPath` at `.githooks/`):
  - `pre-commit` runs `eslint --fix` and `prettier --write` on the staged files, and re-stages only the files it rewrote.
  - `pre-push` runs `pnpm typecheck` over the whole project, since a per-file typecheck misses the files that depend on a changed type.
- Typed linting makes a file's result depend on the types it imports, which `.eslintcache` can't track.
  - `pnpm lint` can serve a stale pass for a file whose own content is unchanged; delete `.eslintcache` when a result looks impossible.
  - The hook and `lint:fix` run without the cache.
- Don't bypass git hooks (`--no-verify`) without explicit approval from the repo owner.

## 🤖 CI

- `.github/workflows/ci.yml` runs on every PR and every push to `main`, as parallel jobs:
  - `lint` — ESLint (uncached, unlike `pnpm lint`) and `pnpm format:check`;
  - `typecheck` — `pnpm typecheck`;
  - `test` — `pnpm test` on Node 22 and 24, and `pnpm test:coverage` on Node 26;
  - `package` — `pnpm lint:package`, `pnpm size`, and `pnpm test:consumer`, with `CI` set, so a stale `exports` map fails the build;
  - `report` — PR-only, after the rest; posts both PR comments.
- **Two sticky PR comments**, each found by its opening heading and edited in place rather than re-posted:
  - `## 📊 Code coverage`, from `scripts/post-coverage-pr-comment.ts`;
  - `## ⏱️ CI timings`, from `scripts/post-ci-timings.ts`, which covers both `ci.yml` and `research-check.yml` on the PR's commit; each workflow's `report` job re-posts it, so the last to finish leaves the full table.
  - A bug in either script fails `report`; a failure to post it can't fix, such as the read-only token fork PRs get, only warns.
- `.github/workflows/codeql.yml` scans on PRs, `main`, and weekly.
- `.github/workflows/research-check.yml` runs only on PRs that touch the harness or what it depends on (its `paths:` list): it installs `research/`, lints and typechecks it, runs `pnpm research --check-inputs` (committed results must match the pinned images and lockfiles) and `pnpm research --format --check`, then a `report` job re-posts the CI timings comment.
- `.github/workflows/research.yml` is manual (`workflow_dispatch`): it runs `pnpm research` from the same Compose file and uploads `research/results/` as an artifact.
- `.github/workflows/release.yml` runs on every push to `main` (see [Versioning & releases](#-versioning--releases)):
  - `release-please` — opens or updates the release PR, and tags the release once it is merged;
  - `publish` — only when a release was just created; builds and publishes to npm.
- `.github/workflows/renovate.yml` runs [Renovate](https://docs.renovatebot.com), configured by `.github/renovate.json5`, on Sunday mornings at 6:15 New York time (and on `workflow_dispatch`):
  - it creates and updates PRs only inside the config's Sunday 6:00-to-8:59am `schedule`, so editing the config never opens PRs midweek;
  - it holds every update for 7 days (`minimumReleaseAge`), matching the [moratorium](#-7-day-dependency-moratorium), and skips digest-only image updates, which have no release date to age;
  - only Docker Hub reports a tag's push date, so an image from another registry (`mcr.microsoft.com`, `ghcr.io`) stays pending until it's ticked on the Dependency Dashboard, once its tag is 7 days old;
  - every bump is a `chore`, so none cuts a release;
  - a typical week opens three grouped PRs: the root's patch and minor bumps, the Actions' patch and minor bumps, and everything under `research/`, majors included, across every manager; a major outside `research/` gets its own PR;
  - pnpm itself (each root's `packageManager`) moves in the `research` PR, so all four pins stay equal, as `scripts/research/package-manager.test.ts` requires;
  - its rules hold the pins below: `typescript` and `@types/node` majors, each `typescript-<version>` alias to its patches, 3.x `python` images to final releases, and `python311` on 3.11, the last Python with `distutils`;
  - it acts as a GitHub App (`RENOVATE_APP_CLIENT_ID` and `RENOVATE_APP_PRIVATE_KEY`), since a PR opened with `GITHUB_TOKEN` starts no CI, and its Dependency Dashboard issue lists pending and held updates;
  - a research bump fails `research-check.yml` until its results are regenerated by hand on the Renovate branch (see [research/README.md](research/README.md#️-dependency-bumps)).
- Every action is pinned to an exact `vX.Y.Z`, and every job declares its own `permissions`.
- How to change a workflow is covered by `.claude/rules/ci.md`.

## 🕒 7-day dependency moratorium

No npm dependency may enter the lockfile until it has been published for **at least 7 days** — a supply-chain guard that gives the registry time to yank a compromised release.

- Enforced by `minimumReleaseAge: 10080` (minutes) in [pnpm-workspace.yaml](pnpm-workspace.yaml), checked on every `pnpm install`, including `--frozen-lockfile`.
  - `research/pnpm-workspace.yaml`, `research/docker/firebase/pnpm-workspace.yaml`, and `research/adapters/assemblyscript/pnpm-workspace.yaml` repeat the floor for the research harness's own pnpm roots; keep all four in sync.
  - The same 7 days applies to a container image (pin a tag whose last push is at least 7 days old), to a Python package (`research/docker/db/requirements.txt`, compiled with `--exclude-newer`; `research/docker/xml-schema/requirements.txt`), and to a release download such as the Hermes CLI tarball.
- A too-new version fails the install with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`.
- When bumping a dependency by hand, pick the newest version that is already at least 7 days old (exactly 7 days is fine). If the lockfile fails the check, downgrade the offending entry rather than relaxing the floor.
- Versions are pinned exactly (`saveExact: true` in [pnpm-workspace.yaml](pnpm-workspace.yaml)); the lockfile is the only thing that moves them.
- **TypeScript stays on 6.0** until `typescript-eslint` supports TypeScript 7; upgrade it in its own `chore(deps)` change.
  - The `typescript-<version>` aliases are consumer-test fixtures, not the repo's compiler; bump them freely within their minor.
- **`@types/node` tracks the `engines.node` floor (22)**, not the newest Node, so the typecheck rejects APIs that a supported Node doesn't have.
- **Developing needs a newer Node than `engines.node`.**
  - `engines.node` is the floor for code that imports the package; the dev tools set their own (jsdom 30 needs `^22.22.2 || ^24.15.0 || >=26`).

## 🚀 Versioning & releases

- The package follows [SemVer](https://semver.org) and starts **pre-stable (0.x)**: a `feat` bumps the minor, a `fix` bumps the patch.
- The first published version is `0.1.0`; `1.0.0` is cut once names and semantics have settled in real use.
- Releases are automated by [release-please](https://github.com/googleapis/release-please), which reads the commit conventions above — this is why the types and gitmojis matter beyond tidiness.
  - It maintains a single rolling release PR; merging that PR bumps `package.json`, writes the changelog, and tags the release.
  - Squash-merge the release PR so its title becomes the commit.
  - **Only `feat`, `fix`, `perf`, `revert`, and a `!` breaking change cut a release** and appear in `CHANGELOG.md`.
  - Every other type is hidden, so a tooling-only change never publishes a new version.
  - The PR carries the `🚀 release` label and a `chore(release): 🚀 bump to vX.Y.Z` title.
- **Never hand-run a version bump or `git tag`**; the release PR owns both.
- **Merging the release PR publishes to npm**, from the `publish` job in `.github/workflows/release.yml`.
  - It uses npm trusted publishing (OIDC), so no npm token exists anywhere; provenance is signed by the same identity.
  - A version already on npm is skipped, so the release that tags the hand-published first version doesn't publish it twice.
- **CI never runs on the release PR**: a PR opened with `GITHUB_TOKEN` starts no workflows.
  - Every commit it lists already passed CI on `main`, and the PR only touches `package.json`'s version, `CHANGELOG.md`, and the manifest.
  - Requiring checks on `main` would block it, unless release-please switches to a GitHub App token.
- `CHANGELOG.md` is in `.prettierignore`, since release-please writes it and Prettier would reformat it.

## 📚 Design decisions

Semantic and design decisions — what "empty" means, how a function is named, why an edge case resolves the way it does — are recorded in [docs/decisions/](docs/decisions/index.md), a small [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) v0.2 bundle.

- One Markdown file per decision, listed in [docs/decisions/index.md](docs/decisions/index.md).
- A comparison table in a decision comes from `research/results/<function>.md`, generated by `pnpm research`, never built by hand.
- Check a decision's `verified` field before changing the behavior it describes:
  - `verified` by `human:jjloneman` means the repo owner reviewed it — change it only with their agreement.
  - No `verified` means it is an unreviewed draft.
- An agent that writes or edits a decision records itself in `generated` and **never** adds a `verified` entry.
- **To verify records, run `pnpm okf:verify`** (or edit the two frontmatter lines by hand):
  - it lists the records changed on the branch, marks the ones you pick `status: stable` with a `verified` entry, and commits just those files;
  - it refuses to run without an interactive terminal and has no flag to skip its prompts, which is what keeps `verified` a human act.

## 🔬 Research harness

`research/` runs each planned function's cases through other languages, libraries, databases, and formats, in pinned containers, so a decision's comparison is measured rather than read from docs. [research/README.md](research/README.md) covers running it and adding a tool.

- It's a separately installed pnpm package (`research/package.json`, its own lockfile and `pnpm-workspace.yaml`), so its libraries never reach the published package or the root lockfile.
- `pnpm research` runs every adapter service in `research/compose.yaml` in parallel and writes `research/results/`; it needs a Docker-compatible runtime (OrbStack on the owner's Mac mini).
- The root ESLint config lints `research/**/*.mts` only once `pnpm --dir research install` has run, since its imports resolve nowhere else.
  - Likewise the AssemblyScript probes (`research/adapters/assemblyscript/*.ts`), typed by the compiler's own standard library, once `pnpm --dir research/adapters/assemblyscript install` has run; `tsc --project research/adapters/assemblyscript` checks them.
- How to change it is covered by `.claude/rules/research.md`.
- **Look things up on GitHub or npm with `pnpm research:usage`**, never a hand-written `gh api search/…` or `curl` loop: name counts (`counts`), how a call's arguments are used (`calls`), a code search's files (`files`), and weekly downloads (`npm`).
  - Its report is JSON by default, for `jq`, and a Markdown table with `--markdown`; either carries its method, date, and caveats, so quote it whole, with the date, in a decision record or comment.
  - When no mode answers the question, add one to the script (see [research/README.md](research/README.md#-usage-in-the-wild)) rather than working around it.

## 📄 Long Markdown files

Every agent session re-reads its instruction files in full, so their size is a recurring cost, and past a certain length rules get skimmed and missed.

- **Past about 500 lines, consider a split.** It's a prompt to weigh, not a hard limit.
  - It applies to every Markdown file agents or contributors read: this file, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `.claude/rules/*.md`, and everything under `docs/`.
- **Split along an existing heading**, so the new file has one clear subject, such as code style.
- **Keep agents finding it** — a split file that agents don't load is worse than a long one:
  - this file keeps a short summary plus an explicit "read `<file>` before editing `<paths>`" line, since agents other than Claude load only this file;
  - `CLAUDE.md` `@`-imports the new file when Claude should always have it;
  - guidance only Claude needs can instead be a path-scoped `.claude/rules/` file, listed in `CLAUDE.md`'s map, as the CI, research, and testing rules already are.
- **Keep one source of truth.** The moved text leaves this file, and every inbound anchor is updated to the new file — grep for `AGENTS.md#`, since `CONTRIBUTING.md` links several sections.

## 🛑 Deleting things

- Confirm with the repo owner before deleting anything the current task didn't create — files, branches, issues, remote state.
- Being gitignored, temporary-looking, or "obviously regenerable" is a reason to ask, not a reason to proceed.
