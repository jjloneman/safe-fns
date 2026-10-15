---
okf_version: "0.2"
---

# Decisions

- [How a function takes its parameters](function-parameters.md) - Up to two positional parameters for the values a function works on, configuration in a trailing options object, and nothing variadic.
- [How deepSortObject orders keys and arrays](deep-sort-object.md) - UTF-16 code-unit key order by default, with `ignoreCase` or a `compareKeys`; arrays keep their order unless `sortArrays` picks them by typed key path, each with its own comparator; cycles are kept, and a failure returns the input unchanged.
- [How exports share code](internal-dependencies.md) - Shared logic lives in non-public modules under `src/internal/`; imports stay shallow, and each entry's size budget catches bloat.
- [How fast an export must be](performance.md) - The common case runs cheap checks first and allocates nothing; each export is benchmarked against the fastest competitor, and robustness beats speed.
- [How getErrorMessage and toError read a thrown value](error-helpers.md) - A message comes from an Error, a thrown string, or an object's own `message`; `getErrorMessage` always returns a string, and `toError` leaves an existing Error untouched.
- [How predicates are named](predicate-naming.md) - Predicates start with `is`, name the positive case, and come in positive/negative pairs rather than negated names.
- [How safeJsonStringify handles what JSON.stringify throws on](safe-json-stringify.md) - Cycles and BigInts are repaired by default, with options to change or refuse each repair; anything else unserializable returns the fallback, and `replacer` and `space` are options.
- [How safeObjectHasOwn narrows](safe-object-has-own.md) - A typed object narrows the key; any other value narrows the object; `null`, primitives, and trapping proxies return `false`.
- [How the storage wrappers behave](safe-storage.md) - `safeStorageGetItem` / `SetItem` / `RemoveItem` plus fixed-area aliases; reads return the fallback for a missing key or blocked storage, and writes return whether they succeeded.
- [What "empty" means for isSafeEmpty and isSafePopulated](is-safe-empty.md) - Nullish values, blank strings, and empty arrays, maps, sets, and plain objects are empty; anything uninspectable is populated, and `isSafePopulated` narrows only its true branch.
- [What a parser returns when it can't parse](parser-fallbacks.md) - Parsers return the caller's fallback, `undefined` by default, for any input they don't recognize — never a guess.
- [What counts as a plain object](is-plain-object.md) - A prototype of `Object.prototype` (any realm) or `null`, and no `Symbol.toStringTag` or `Symbol.iterator`; no `isRecord`.
- [What every export promises](package-promise.md) - Every export is total and precisely typed; taking an `unknown` value is the common case, not a requirement.
- [What safeParseBoolean accepts](safe-parse-boolean.md) - Booleans, `1` / `0`, `1n` / `0n`, and `true` `t` `yes` `y` `on` `1` / `false` `f` `no` `n` `off` `0`, trimmed and in any case, the set `yn`, Python's `strtobool`, and systemd share; everything else returns the fallback.
- [What safeParseJson returns](safe-parse-json.md) - A `JsonValue` by default; an optional `guard` checks the shape at runtime, and an explicit type argument is the caller's unchecked assertion.
- [What safeParseNumber and safeParseInteger accept](safe-parse-number.md) - Finite numbers and trimmed decimal strings; hex, units, separators, and blanks return the fallback, and `min` / `max` reject or, with `clamp`, clamp.
- [What safeParseString accepts and returns](safe-parse-string.md) - Strings, finite numbers, bigints, and booleans become trimmed, non-blank text; everything else returns the fallback.
- [What safeParseUrl accepts](safe-parse-url.md) - A string or `URL`, trimmed of blank characters and parsed by the native URL parser against an optional `base`, returning a new `URL` or the fallback; an opt-in `protocols` list rejects any other scheme.
- [What safeStructuredClone returns when cloning fails](safe-structured-clone.md) - The native clone, with a `functions` option to keep or omit functions and symbols; otherwise the fallback when `structuredClone` throws or is missing.
- [What the package leaves to native APIs and other libraries](native-first-scope.md) - Excludes what native JavaScript already does and wrappers around native one-liners; parks newer native APIs, date and currency-amount parsing, and duration and byte formatting as future candidates; leaves validation to dedicated libraries.
- [When a name starts with `safe`](safe-prefix-naming.md) - `safeParse` + what it reads for every parser, `safe` + the native API's path for any other wrapper of one native API, `isSafe*` against a same-named unsafe helper, and plain names otherwise.

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

A decision that compares other tools quotes the generated `research/results/<function>.md` from `pnpm research` ([research/README.md](../../research/README.md)), rather than a hand-built table.
