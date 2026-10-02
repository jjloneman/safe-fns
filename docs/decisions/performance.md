---
type: Decision
title: How fast an export must be
description: The common case runs cheap checks first and allocates nothing; each export is benchmarked against the fastest competitor, and robustness beats speed.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-01T15:00:00Z }
---

# How fast an export must be

Every export aims to match or beat the fastest library doing the same job, without giving up a robustness guarantee.

## Decision

- **Cheap checks come first, ordered by cost.**
  1. `typeof` and `=== null`, which settle most primitives;
  2. built-in checks such as `Array.isArray`;
  3. prototype checks such as `Object.getPrototypeOf`;
  4. walking the value — its keys, entries, or nested values.
- **The common case allocates nothing it doesn't return.**
  - No spread copies, no closures created per call, and no `Object.keys` array where a loop will do.
  - Regular expressions and lookup tables are built once, at module level.
- **No wrapper layers.** No currying, no data-first/data-last dispatch, no argument juggling before the real work.
- **Guards cost nothing until they fire.**
  - A `try` block runs at full speed in current engines until something throws, so wrapping a risky step is free on the common case.
  - Wrap whole risky steps, not each property read.
- **Benchmarks decide, not intuition.**
  - Each export ships with a benchmark against its competitors (e.g. `isDeepEqual` against `fast-deep-equal`, `dequal`, lodash's `isEqual`, and ramda's `equals`).
  - The target is the fastest competitor's speed on representative input.
- **Robustness beats speed.**
  - When a guarantee costs speed — no duck-typing, no throwing, cross-realm safety — keep the guarantee and document the cost.
  - remeda's `isEmptyish` is faster partly because it duck-types any `{ length }` object; this package doesn't follow it there.
- **A plain loop is fine in `src/` where a benchmark shows it's faster** than `map` / `filter` / `reduce`; functional style stays the default elsewhere.

## Why

- Speed is part of why the owner wants to replace lodash, whose `isEmpty` was the slowest measured.
- A micro-benchmark of `isEmpty` spans 30× (2026-09-29): lodash-es 424 ops/ms, ramda 427, es-toolkit's compat build 6,266, remeda 12,511.
  - Setup: Node 26.10.0; lodash-es 4.18.1, ramda 0.32.0, es-toolkit 1.52.0, remeda 2.50.0 (its `isEmptyish`).
  - Input: each call checks 8 values — `{}`, `[]`, `""`, `"x"`, `0`, `null`, an empty `Map`, and `{ a: 1 }`.

## Consequences

- AGENTS.md gains a "Fast on the common path" design principle, and its functional-style rule names the loop exception.
- The benchmark harness ([#12](https://github.com/jjloneman/safe-fns/issues/12)) lands before the first function, so each function's PR includes its own benchmark.
- Each per-function decision names its competitors and its expected common case.
