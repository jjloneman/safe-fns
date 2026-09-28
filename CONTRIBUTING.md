# 🤝 Contributing to safe-fns

Thanks for helping out! This guide covers the dev loop and how to add a function.

- [AGENTS.md](AGENTS.md) is the single source of the repo's conventions, for people and AI agents alike.
  - This guide links to its sections rather than repeating them.
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📚 Table of Contents

- [📚 Table of Contents](#-table-of-contents)
- [✅ Prerequisites](#-prerequisites)
- [🔁 Dev loop](#-dev-loop)
- [🧭 Design principles](#-design-principles)
- [➕ Adding a function](#-adding-a-function)
- [✍️ Commits and pull requests](#️-commits-and-pull-requests)
- [🐞 Reporting a bug or asking a question](#-reporting-a-bug-or-asking-a-question)

---

## ✅ Prerequisites

- **Node** 22.22.2+, 24.15.0+, or 26+.
  - The package supports Node 22 and newer, but the dev tools need a recent patch release.
- **pnpm**, installed once globally.
  - `package.json`'s `packageManager` field decides the version that actually runs.

---

## 🔁 Dev loop

```sh
pnpm install       # also installs the git hooks
pnpm test:watch    # rerun tests on change
pnpm test:coverage # the 100% coverage gate
pnpm check         # lint --fix, format, typecheck — run before committing
```

- `pnpm check` rewrites files, so read the diff after it runs.
- The git hooks back it up:
  - `pre-commit` lints and formats the staged files;
  - `pre-push` typechecks the whole project.
- New dependencies must have been published for at least 7 days.
  - See [the dependency moratorium](AGENTS.md#-7-day-dependency-moratorium).
- The full list of scripts is in the [README](README.md#-scripts).

---

## 🧭 Design principles

Every export is **total**: it never throws, and bad input returns a fallback the caller chooses.

- The full set of principles is in [AGENTS.md](AGENTS.md#-design-principles).
- A change that breaks one is a bug, even if its tests pass.

---

## ➕ Adding a function

1. **Open an issue first** with the ✨ feature form, so the name and semantics can be agreed before any code.
2. **Create `src/<kebab-name>.ts`** holding exactly one export, with TSDoc on it.
   - The file name becomes its subpath: `src/is-safe-empty.ts` → `safe-fns/is-safe-empty`.
   - Style rules are in [AGENTS.md](AGENTS.md#-code-style-guidelines).
3. **Re-export it** from `src/index.ts`.
4. **Write its tests beside it** as `<kebab-name>.test.ts` and `<kebab-name>.test-d.ts`.
   - Add rows to the shared cross-environment table and run it over the hostile inputs.
   - See [AGENTS.md → Testing](AGENTS.md#-testing) and [the testing rule](.claude/rules/testing.md).
5. **Run `pnpm build`**, then commit the regenerated `exports` map in `package.json`.
6. **Give it a size budget** in `size-limit.config.ts`.
7. **Import it** in `test/consumer/types.ts`, so the consumer typecheck covers it.
8. **Record any non-obvious semantic choice** in [docs/decisions/](docs/decisions/index.md).
9. **Document it** in the README's [API section](README.md#-api).

---

## ✍️ Commits and pull requests

- Commits and PR titles follow [Conventional Commits with a gitmoji](AGENTS.md#️-commit-conventions), e.g. `feat(is-safe-empty): ✨ add is safe empty`.
  - The type decides the release: `feat` bumps the minor version, and `fix` bumps the patch.
- Name branches `feature/gh-<issue>-<slug>` or `bugfix/gh-<issue>-<slug>`.
- PRs are squash-merged, so the PR title becomes the commit on `main`.
- Fill in the PR template, and link the issue with `Closes #<n>`.

---

## 🐞 Reporting a bug or asking a question

- Use the [issue forms](https://github.com/jjloneman/safe-fns/issues/new/choose):
  - 🐞 bug report;
  - ✨ feature or new function;
  - 🤔 semantics question, for "why does X count as empty?".
- Report security issues privately instead, as described in [SECURITY.md](SECURITY.md).
