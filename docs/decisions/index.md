---
okf_version: "0.2"
---

# Decisions

- [How exports share code](internal-dependencies.md) - Shared logic lives in non-public modules under `src/internal/`; imports stay shallow, and each entry's size budget catches bloat.
- [How predicates are named](predicate-naming.md) - Predicates start with `is`, name the positive case, and come in positive/negative pairs rather than negated names.
- [What a parser returns when it can't parse](parser-fallbacks.md) - Parsers return the caller's fallback, `undefined` by default, for any input they don't recognize — never a guess.
- [What every export promises](package-promise.md) - Every export is total and precisely typed; taking an `unknown` value is the common case, not a requirement.
- [What the package leaves to native APIs and other libraries](native-first-scope.md) - No reimplementing what native JavaScript does well, no wrappers around native one-liners, and dates, byte formatting, and validation stay with dedicated libraries.
- [When a function takes positional parameters](function-parameters.md) - Two or more parameters go in one object, except for a function that mirrors a native signature or compares two values; nothing is variadic.
- [When a name starts with `safe`](safe-prefix-naming.md) - `safe` + the native API's path for a wrapper of one native API, `safeParse*` for coercers, `isSafe*` against a same-named unsafe helper, and plain names otherwise.

# About this bundle

This directory is an [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle of the package's semantic and design decisions — one Markdown file per decision, listed above as `- [Title](file.md) - one-line description`.

Each decision opens with YAML frontmatter:

```yaml
---
type: Decision
title: What "empty" means for strings
description: Whitespace-only strings are empty; the check trims first.
status: stable
generated: { by: <agent>/<model-id>, at: 2026-09-27T12:00:00Z }
verified: { by: human:jjloneman, at: 2026-09-28T09:00:00Z }
---
```

- **`type`** — always `Decision`.
- **`status`** — the decision's lifecycle:
  - `draft` — proposed, not yet settled.
  - `stable` — in force (the default when `status` is absent).
  - `deprecated` — superseded; kept for links and history.
- **`generated`** — who or what wrote the current text, and when.
  - `by` is an actor: `<producer>/<version>` for an agent, `human:<id>` for a person.
- **`verified`** — who has reviewed the decision, and when.
  - Absent means unreviewed.
  - `human:jjloneman` means the repo owner signed off — treat it as settled, and change it only with their agreement.
  - Agents never add a `verified` entry.
