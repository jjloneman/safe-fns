---
type: Decision
title: What the package leaves to native APIs and other libraries
description: No reimplementing what native JavaScript does well, no wrappers around native one-liners, and dates, byte formatting, and validation stay with dedicated libraries.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-30T20:24:01Z }
---

# What the package leaves to native APIs and other libraries

Every export has to earn its place over what the platform or an established library already does.

## Decision

- **Native JavaScript already covers these, so they aren't exported:**
  - `map` / `filter` / `reduce` and the rest of lodash's collection functions;
  - `uniq` — `[...new Set(array)]` is already linear;
  - `groupBy` — `Object.groupBy` / `Map.groupBy` (ES2024);
  - set union, intersection, and difference — the `Set` methods (ES2025);
  - random IDs — `crypto.randomUUID()` and `crypto.getRandomValues()`;
  - `cloneDeep` — `structuredClone`, with `safeStructuredClone` for input it would throw on;
  - an error check — `Error.isError` (Node 24+ and current browsers, not Node 22); a library can't reproduce it reliably across realms, so callers on older runtimes keep `instanceof Error` and its limits.
- **No wrappers around native one-liners:**
  - `areAllSafeEmpty` / `areSomeSafeEmpty` — `values.every(isSafeEmpty)`;
  - `areAllDeepEqual` — `rest.every((value) => isDeepEqual(first, value))`.
- **Dedicated libraries own these:**
  - dates — `safeParseDate` and `formatDuration` are out; recommend [luxon](https://www.npmjs.com/package/luxon);
  - byte formatting — `formatBytes` is parked: [`bytes`](https://www.npmjs.com/package/bytes), [`pretty-bytes`](https://www.npmjs.com/package/pretty-bytes), and [`filesize`](https://www.npmjs.com/package/filesize) cover its many options;
  - schema validation — [zod](https://www.npmjs.com/package/zod);
  - English inflection dictionaries — `pluralize` handles regular endings and takes an explicit plural for the rest.
- **A tweak of a native API stays close to it,** in name and in shape (see [When a name starts with `safe`](safe-prefix-naming.md)).

## Why

- The owner doesn't want to reimplement lodash functions that modern JavaScript made redundant.
- Every export adds surface to document, test at 100% coverage, and keep total; one that saves no real work isn't worth that cost.
