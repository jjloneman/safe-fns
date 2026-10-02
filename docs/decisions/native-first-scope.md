---
type: Decision
title: What the package leaves to native APIs and other libraries
description: No reimplementing what native JavaScript does well, no wrappers around native one-liners, newer native APIs parked rather than excluded, and date parsing and validation left to dedicated libraries.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-01T15:00:00Z }
---

# What the package leaves to native APIs and other libraries

Every export has to earn its place over what the platform or an established library already does.

## Decision

- **Native JavaScript already covers these, so they aren't exported:**
  - `map` / `filter` / `reduce` and the rest of lodash's collection functions;
  - `uniq` — `[...new Set(array)]` is already linear;
  - random IDs — `crypto.randomUUID()` and `crypto.getRandomValues()`;
  - `cloneDeep` — `structuredClone`, with `safeStructuredClone` for input it would throw on;
  - an error check — `Error.isError` (Node 24+ and current browsers, not Node 22); a library can't reproduce it reliably across realms, so callers on older runtimes keep `instanceof Error` and its limits.
- **Parked, not excluded: native APIs that older targets lack.**
  - `groupBy` — `Object.groupBy` / `Map.groupBy` (ES2024);
  - set union, intersection, and difference — the `Set` methods (ES2025);
  - `formatDuration` — [`Intl.DurationFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat) (ES2025, Node 24+, not Node 22) already formats `{ minutes: 2, seconds: 34, milliseconds: 4 }` as `2m 34s 4ms` (`style: "narrow"`), `2 min, 34 sec, 4 ms`, or `0:02:34.004`.
    - What it doesn't do is balance units: `{ minutes: 150 }` prints `150m`, not `2h 30m`.
    - A `formatDuration` would balance milliseconds into units — the inverse of `toMs` — and format them itself, so it returns the same string on every runtime; `Intl.DurationFormat` stays the native choice for callers on Node 24+.
  - Many consumers still target ES2020–ES2022 (the owner's Angular apps among them), where these are missing at runtime or in TypeScript's `lib`.
  - Each can become a candidate if those consumers need it; until then, the native API is the recommendation.
- **No wrappers around native one-liners:**
  - `areAllSafeEmpty` / `areSomeSafeEmpty` — `values.every(isSafeEmpty)`;
  - `areAllDeepEqual` — `rest.every((value) => isDeepEqual(first, value))`.
- **Dedicated libraries own these:**
  - date parsing — `safeParseDate` is out; recommend [luxon](https://www.npmjs.com/package/luxon);
  - byte formatting — `formatBytes` is parked.
    - [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) with `style: "unit"` formats a value you've already scaled (`2.5 megabytes`, `2.5 MB`, `2.5MB`), but doesn't pick the unit, and has no binary units (`kibibyte` throws a `RangeError`).
    - [`bytes`](https://www.npmjs.com/package/bytes), [`pretty-bytes`](https://www.npmjs.com/package/pretty-bytes), and [`filesize`](https://www.npmjs.com/package/filesize) cover the scaling and its many options;
  - schema validation — [zod](https://www.npmjs.com/package/zod);
  - English inflection dictionaries — `pluralize` handles regular endings and takes an explicit plural for the rest.
- **A tweak of a native API stays close to it,** in name and in shape (see [When a name starts with `safe`](safe-prefix-naming.md)).

## Why

- The owner doesn't want to reimplement lodash functions that modern JavaScript made redundant.
- Every export adds surface to document, test at 100% coverage, and keep total; one that saves no real work isn't worth that cost.
