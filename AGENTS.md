# 🤖 AGENTS.md

Conventions for any AI agent (or human) working in this repo. Read top to bottom before editing.

## 🎯 Purpose of this repo

`safe-fns` is a standalone, zero-dependency, strongly typed npm package of helpers that take an `unknown` value and return a safe, typed result.

- **Every export is total**: it never throws, and bad input returns a fallback the caller chooses.
- It replaces helpers that were copy-pasted across several projects and had drifted apart.
- The roadmap and the reasoning behind the package live in the umbrella issue, [#1](https://github.com/jjloneman/safe-fns/issues/1).

## 🧭 Design principles

These bind every exported function. A change that breaks one is a bug, even if its tests pass.

- **Environment-independent.** A function returns the same result in Node, every browser, and any other JS runtime.
  - Never branch on `typeof window`, `process`, or any other environment probe.
  - Where an engine genuinely differs (ICU data, non-ISO date parsing), document it rather than papering over it.
- **Never widen a narrow check.** A check matches exactly what its name says, identified by a reliable test (`Array.isArray`, a brand check) rather than by shape.
  - Don't duck-type: an object with a `length` or `size` key is not a collection, and `{ length: 0, name: "x" }` is not "empty".
  - Loosening a published check is a breaking change, never a drive-by.
- **Fail safe toward preserving data.** When a value can't be inspected safely, pick the answer that keeps it: an uninspectable value is "populated", not "empty".
- **Never throw.** Every export catches what it touches — getters, proxies, `toString`/`valueOf` traps, revoked proxies — and returns the caller's fallback instead.
- **No unreachable branches.** Coverage is 100%; a branch nothing can reach is dead code to delete, not a line to exempt.
- **Zero runtime dependencies.** `dependencies` and `peerDependencies` stay empty.
- **One function per file.** Each export lives in its own file under `src/`, so each gets its own subpath and its own output file.

## 🗂️ Project layout

- `src/` — library source.
  - `src/index.ts` is the root entry and re-exports every function.
  - It currently holds a single placeholder export, removed when the first real function lands.
- `.githooks/` — the pre-commit and pre-push hooks (see [Pre-commit checks](#-pre-commit-checks)).
- `docs/decisions/` — the design-decision bundle (see [Design decisions](#-design-decisions)).
- `eslint-rules/` — local ESLint rules, loaded by `eslint.config.ts`.
- `eslint.config.ts` — ESLint flat config.
  - TypeScript gets the full typed presets (`strictTypeChecked` + `stylisticTypeChecked`), perfectionist's `recommended-alphabetical` ordering, and `tsdoc/syntax`.
  - JSON and YAML get `jsonc/sort-keys` and `yml/sort-keys`; `package.json` is excluded and keeps the `sort-package-json` order through `prettier-plugin-packagejson`.
- `prettier.config.ts` — Prettier defaults plus `trailingComma: "es5"`, the `package.json` sorter, and a shell parser for `.githooks/`.
- `tsconfig.json` — one root covering `src`, `test`, `scripts`, `eslint-rules`, and the root-level `*.config.ts` files.
  - An editor and ESLint's project service both resolve a file by walking up to the nearest config named exactly `tsconfig.json`, so every TypeScript file must fall inside this root's `include`.
  - Don't add a differently named config (`tsconfig.eslint.json`, …) to cover a directory; it typechecks in CI while leaving the editor and the linter blind.

## 🎨 Code style guidelines

### 🏛️ Architecture & design mindset

- **Think holistically, like an architect.** Weigh each change against the whole package — where a responsibility should live, what a module's boundaries are — not just the file in front of you.
- **But don't over-architect.** No speculative abstraction, factories, or config layers a single call site doesn't justify. The simplest design that keeps concerns separated wins.
- **Watch for god files and god functions.** When one starts accreting unrelated responsibilities, split it rather than piling on.
- **Semantic naming everywhere.** Files, types, functions, and params say what the thing is or does. Avoid vague names (`data`, `tmp`, `obj`) except where scope is trivial.
- **American English in all prose** — comments, TSDoc, test names, docs, commit messages, and issue/PR bodies (`color`, `behavior`, `-ize`).
  - Identifiers and third-party APIs keep whatever spelling they already have.

### 🔷 TypeScript

- **Strict types**: no `any`. Let inference work where an annotation would be redundant.
  - Exported functions always declare their return type — `isolatedDeclarations` enforces it.
- **Avoid `as unknown as T`.** Prefer `satisfies`; when a full `T` isn't practical (e.g. a test stub), assert through a `Partial` first: `({ … }) satisfies Partial<T> as T`.
- **Derive types from existing types** (`Options["fallback"]`, `Pick<…>`, indexed access) rather than re-spelling a primitive, so a change propagates through tsc instead of drifting.
- **`type` over `interface`** — use `interface` only when declaration merging is genuinely needed.
- **`import type`** for type-only imports (`verbatimModuleSyntax` enforces it).
- **`as const` objects over `enum`s**, paired with `(typeof OBJ)[keyof typeof OBJ]` for the union type.

### 🧱 Code shape

- **Lexicographic ordering**: everything perfectionist's `recommended-alphabetical` preset can sort stays alphabetized.
  - That covers object keys, type members, imports and exports, union and intersection members, `Set`/`Map`/array-`includes` entries, switch cases, class members, and a module's top-level declarations.
  - Where an order carries meaning, disable the rule on that line with an `eslint-disable-next-line` comment saying why, rather than turning it off in the config.
  - Ordering is case-insensitive unless a tool says otherwise — `fallback` sorts before `Options`.
- **Function parameters**: one positional argument is fine; with two or more, take a single object with sorted keys. Options go in an object even when there is only one.
- **Prefer functional over imperative** — `map`/`filter`/`reduce` and pure helpers over mutable loops, unless the loop is genuinely clearer.
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
  - Inside a library function, remember that the constructors themselves can throw on hostile input — guard them per the design principles.
- **No nested ternaries.** Use a named helper whose guards read top to bottom, or a lookup keyed by the discriminant.
- **Property access**: dot notation for valid identifiers; brackets only for dynamic or special-character keys.
- **Array access**: `.at(-1)` for the last element only — briefer and cleaner than `array[array.length - 1]`; plain `array[i]` everywhere else.
- **Strings**: template literals over concatenation.
- **Regexes use named capture groups** — `(?<objectName>…)`, read through `match.groups`, never a positional `match[2]`.
  - A group whose text isn't read is non-capturing, `(?:…)`.
  - Enforced by ESLint's `prefer-named-capture-group`.

### 💬 Comments and TSDoc

- **Comment only _why_** — non-obvious constraints, workarounds, invariants. Never restate what the code does, and never reference current tasks, PRs, or callers; those rot.
  - Tests are the exception: each test body uses `// Given` / `// When` / `// Then` section comments, with `// And` to continue the previous phase.
  - `// Setup` and `// Cleanup` mark setup or teardown that belongs to one specific test rather than a shared hook.
- **Comment shape: lead sentence, then bullets.**
  - A comment of three lines or more uses the block form (`/* … */`, or `/** … */` for TSDoc), not stacked `//` lines.
  - The first sentence is prose; every following point is a `-` bullet, with a blank line between bullets.
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
| `ci`       | 🤖      | CI / dependabot / workflow changes |
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
- **AI-written text on GitHub opens with a disclaimer banner.** Any issue body, PR body, or comment an AI agent writes begins with this line, then a blank line:

  ```md
  > **🤖 Disclaimer**: This description was generated with AI. (**Model**: _<model name and version>_)
  ```

  - Use "description" for an issue or PR body, and "comment" for a comment.
  - Name the model that actually wrote the text, by its human-readable name and version, not its raw API id.
  - Never add the banner to text a human wrote.

## 🧪 Pre-commit checks

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

## 🕒 7-day dependency moratorium

No npm dependency may enter the lockfile until it has been published for **at least 7 days** — a supply-chain guard that gives the registry time to yank a compromised release.

- Enforced by `minimumReleaseAge: 10080` (minutes) in [pnpm-workspace.yaml](pnpm-workspace.yaml), checked on every `pnpm install`, including `--frozen-lockfile`.
- A too-new version fails the install with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`.
- When bumping a dependency by hand, pick the newest version that is already at least 7 days old (exactly 7 days is fine). If the lockfile fails the check, downgrade the offending entry rather than relaxing the floor.
- Versions are pinned exactly (`saveExact: true` in [pnpm-workspace.yaml](pnpm-workspace.yaml)); the lockfile is the only thing that moves them.
- **TypeScript stays on 6.0** until `typescript-eslint` supports TypeScript 7; upgrade it in its own `chore(deps)` change.
- **`@types/node` tracks the `engines.node` floor (22)**, not the newest Node, so the typecheck rejects APIs that a supported Node doesn't have.

## 🚀 Versioning & releases

- The package follows [SemVer](https://semver.org) and starts **pre-stable (0.x)**: a `feat` bumps the minor, a `fix` bumps the patch.
- The first published version is `0.1.0`; `1.0.0` is cut once names and semantics have settled in real use.
- Releases are automated by [release-please](https://github.com/googleapis/release-please), which reads the commit conventions above — this is why the types and gitmojis matter beyond tidiness.
  - It maintains a single rolling release PR; merging that PR bumps `package.json`, writes the changelog, and tags the release.
  - Squash-merge the release PR so its title becomes the commit.
- **Never hand-run a version bump or `git tag`**; the release PR owns both.

## 📚 Design decisions

Semantic and design decisions — what "empty" means, how a function is named, why an edge case resolves the way it does — are recorded in [docs/decisions/](docs/decisions/index.md), a small [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) v0.2 bundle.

- One Markdown file per decision, listed in [docs/decisions/index.md](docs/decisions/index.md).
- Check a decision's `verified` field before changing the behavior it describes:
  - `verified` by `human:jjloneman` means the repo owner reviewed it — change it only with their agreement.
  - No `verified` means it is an unreviewed draft.
- An agent that writes or edits a decision records itself in `generated` and **never** adds a `verified` entry.

## 🛑 Deleting things

- Confirm with the repo owner before deleting anything the current task didn't create — files, branches, issues, remote state.
- Being gitignored, temporary-looking, or "obviously regenerable" is a reason to ask, not a reason to proceed.
