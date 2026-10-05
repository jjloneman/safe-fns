---
type: Decision
title: What the package leaves to native APIs and other libraries
description: Excludes what native JavaScript already does and wrappers around native one-liners; parks newer native APIs, date parsing, and duration and byte formatting as future candidates; leaves validation to dedicated libraries.
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-03T21:14:18Z }
verified: { by: human:jjloneman, at: 2026-10-05T15:38:06Z }
---

# What the package leaves to native APIs and other libraries

Every export has to earn its place over what the platform or an established library already does.

## Decision

Every candidate the catalog weighed against a native API or another library lands in one of three groups.

### ❌ Excluded — native JavaScript already does this

- `map` / `filter` / `reduce` and the rest of lodash's collection functions.
- `uniq` — `[...new Set(array)]` is already linear.
- Random IDs — `crypto.randomUUID()` and `crypto.getRandomValues()`.
- lodash's `cloneDeep` — use native `structuredClone`.
  - This package plans `safeStructuredClone`, which returns the caller's fallback where `structuredClone` throws.
  - That isn't a one-liner wrapper of the kind excluded below: making a native call that can throw safe is the package's purpose, like `safeJsonStringify`.
- An error check — `Error.isError` (Node 24+ and current browsers, not Node 22).
  - A library can't reproduce it reliably across realms, so callers on older runtimes keep `instanceof Error` and its limits.
- Wrappers around native one-liners:
  - `areAllSafeEmpty` / `areSomeSafeEmpty` — `values.every(isSafeEmpty)`;
  - `areAllDeepEqual` — `rest.every((value) => isDeepEqual(first, value))`.

### ⏸️ Parked — not now, but may become candidates

- `groupBy` — `Object.groupBy` / `Map.groupBy` (ES2024).
- Set union, intersection, and difference — the `Set` methods (ES2025).
- `formatDuration` — [`Intl.DurationFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat) (ES2025, Node 24+, not Node 22) already formats `{ minutes: 2, seconds: 34, milliseconds: 4 }` as `2m 34s 4ms` (`style: "narrow"`), `2 min, 34 sec, 4 ms`, or `0:02:34.004`.
  - What it doesn't do is balance units: `{ minutes: 150 }` prints `150m`, not `2h 30m`.
  - A `formatDuration` would balance milliseconds into mixed units — the inverse of `toMs` — and format them itself, so it returns the same string on every runtime.
- `safeParseDate` — `Date.parse` returns `NaN` for input it can't read and parses non-ISO strings differently per engine, so a total wrapper with a caller-chosen fallback may still earn a place.
- `formatBytes` — [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) with `style: "unit"` formats a value you've already scaled (`2.5 megabytes`, `2.5 MB`, `2.5MB`), but doesn't pick the unit, and has no binary units (`kibibyte` throws a `RangeError`).
- Why each is parked rather than excluded:
  - `groupBy`, the `Set` methods, and `Intl.DurationFormat` are newer than many consumers' targets — the owner's Angular apps among them still target ES2020–ES2022, where they're missing at runtime or in TypeScript's `lib`;
  - `formatDuration` and `formatBytes` would also fill gaps the native APIs leave (mixed units; picking the unit);
  - `safeParseDate` would make `Date.parse`'s per-engine behavior total and predictable.
- Each can become a candidate if a consumer needs it.
- Until then, the recommendation is:
  - the native API where the runtime has it;
  - [luxon](https://www.npmjs.com/package/luxon) for dates;
  - [`bytes`](https://www.npmjs.com/package/bytes), [`pretty-bytes`](https://www.npmjs.com/package/pretty-bytes), or [`filesize`](https://www.npmjs.com/package/filesize) for byte sizes.

### 📚 Left to dedicated libraries

- Schema validation — [zod](https://www.npmjs.com/package/zod).
- English inflection dictionaries — `pluralize` handles regular endings and takes an explicit plural for the rest.

### 🧭 Staying close to native

- A tweak of a native API stays close to it, in name and in shape (see [When a name starts with `safe`](safe-prefix-naming.md)).

## Why

- The owner doesn't want to reimplement lodash functions that modern JavaScript made redundant.
- Every export adds surface to document, test at 100% coverage, and keep total; one that saves no real work isn't worth that cost.
