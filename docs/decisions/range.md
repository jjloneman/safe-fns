---
type: Decision
title: How range counts
description: "`range(end, options?)` counts `0` up to `end`, and `range(start, end, options?)` counts from `start` toward `end` in either direction, as `Iterator.range` does; `end` is excluded unless `inclusive`, each value is `start + i * step`, and a step pointing away from `end` or a count of zero or less is `[]`; a bound or step that is not a finite number, a zero step, more than 2^24 items, a step too small to change the value, or a throw returns the `fallback` option, `[]` by default; there is no bigint range."
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-31T23:34:00Z }
verified: { by: human:jjloneman, at: 2026-10-31T23:44:08Z }
---

# How range counts

`range(end)` and `range(start, end, options?)` replace `Array.from({ length: n }, (_, i) => i)`: `range(4)` is `[0, 1, 2, 3]`, `range(4, 0)` is `[4, 3, 2, 1]`, and `range(0, 10, { step: 3 })` is `[0, 3, 6, 9]`.

## Decision

- **Signature:** two overloads, shaped after the TC39 [`Iterator.range`](https://github.com/tc39/proposal-iterator.range) proposal, which takes `start`, `end`, and an options object.

  ```ts
  range<F = number[]>(
    end: number,
    options?: { fallback?: F },
  ): number[] | F

  range<F = number[]>(
    start: number,
    end: number,
    options?: {
      fallback?: F;
      inclusive?: boolean;
      step?: number;
    },
  ): number[] | F
  ```

  - `start` and `end` are the two values the function works on, so they're positional, as [How a function takes its parameters](function-parameters.md) asks; `step` is configuration, so it goes in the options object, as `Iterator.range` allows, rather than third, as lodash and es-toolkit take it.
  - `range(end)` is the form `Array.from({ length })` replaces, and nearly half the `_.range` calls sampled below; it takes only `fallback`, so a step or `inclusive` needs `range(0, end, { … })`.
  - The two forms are told apart by whether the second argument is a number.
  - With no `fallback`, `F` is `number[]`, so the result is typed `number[]`.
  - `inclusive` is a boolean, named as the proposal names it.
  - The result is a new array each call; a literal-tuple type such as `[0, 1, 2]` for `range(3)` would need recursive types with a depth limit, and slows the compiler for no runtime gain.

- **`range(end)` is a count:** `range(4)` is `[0, 1, 2, 3]`, and an `end` of `0` or less is `[]`, as `Array.from({ length: -3 })` and Python's `range(-3)` are; it never counts down.
- **`range(start, end)` counts toward `end`, either way**, as the proposal does: with no step, the step is `1` when `start < end` and `-1` when `start > end`, so `range(4, 0)` is `[4, 3, 2, 1]`.
  - An explicit step wins, and one pointing away from `end` is `[]`, as in the proposal: `range(4, 0, { step: 1 })` and `range(1, 4, { step: -1 })`.
  - The docs say a computed pair can count down: `range(offset, total)` with `total < offset` is descending, so a caller who wants `[]` there writes `range(offset, Math.max(offset, total))`.
- **`end` is excluded**, as in the proposal, Python, Kotlin's `until`, Java's `IntStream.range`, and every JavaScript library but radash; `inclusive: true` includes it when a value lands on it exactly: `range(0, 9, { inclusive: true, step: 3 })` is `[0, 3, 6, 9]`, `range(4, 0, { inclusive: true })` is `[4, 3, 2, 1, 0]`, and `range(3, 3, { inclusive: true })` is `[3]`.
- **Each value is `start + i * step`**, computed from the index rather than added up:
  - `range(0, 1, { step: 0.1 })` ends `…, 0.8, 0.9`, not lodash's `…, 0.7999999999999999, 0.8999999999999999`;
  - floats are still floats: its fourth value is `0.30000000000000004`, as `3 * 0.1` is, so the docs show `range(10).map((i) => i / 10)` for exact tenths;
  - `range(-0, 2)` starts at `0`, since `-0 + 0 * 1` is `0`.

- **It checks its input in this order**, and the first check that fails returns the `fallback` option, `[]` by default:
  1. `start`, `end`, and `step` are each of type `"number"`, which rejects a numeric string (`"3"`), `null`, a bigint, and a missing `end` in one test;
  2. each is finite by `Number.isFinite`, which rejects `NaN` too;
  3. `step` isn't `0`;
  4. the count, `end / step - start / step` rounded up, is at most 2^24 (16,777,216); dividing first keeps `range(-Number.MAX_VALUE, Number.MAX_VALUE, { step: Number.MAX_VALUE })`, whose `end - start` overflows, at `[-Number.MAX_VALUE, 0]`;
  5. each value differs from the one before it, which catches a step too small to change the value at that magnitude: `range(2 ** 52, 2 ** 52 + 2, { step: 0.5 })` would repeat `2 ** 52`, and `range(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 3)` would repeat `2 ** 53`.

- **The count bounds the loop**, not a comparison of values, so the loop always ends: it runs at most 2^24 + 1 times, and the comparison with `end` only decides whether the last value is kept.
- **Any finite number is a valid bound**, so the safe-integer limits need no special case: `range(Number.MAX_SAFE_INTEGER - 2, Number.MAX_SAFE_INTEGER)` is exact, `range(2 ** 60, 2 ** 60 + 4096, { step: 1024 })` is four exact values past the safe range, and `range(0, 1.5e-323, { step: 5e-324 })` counts the smallest subnormals.
- **`[]` is a result, and the fallback is for input it can't count:**
  - `[]` for a count of zero or less, `start === end`, and a step pointing away from `end`, which are empty ranges, as the proposal treats them;
  - the fallback for everything the checks above reject, and for options that throw when read (a revoked proxy, a throwing getter or trap);
  - so `range(0, n, { fallback: undefined })` is `undefined` exactly when `n` is `NaN`, infinite, or too large, and `[]` when `n` is `0`.

- **A result longer than 2^24 items returns the fallback**, the same in every engine:
  - every engine has a limit far below the array limit of 2^32 − 1: in Node 26, an array built by `push` throws a catchable `RangeError` near 2^27 items, but a 2^29-item array allocated up front crashed the process with an out-of-memory error no `catch` can stop;
  - 2^24 numbers are 128 MB, more than any range in the sample below asks for;
  - `range(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, { step: 1e-200 })` asks for about 1.8 × 10^216 items, so it returns the fallback before allocating anything.

- **No bigint range**, for now: `range(1n, 4n)` returns the fallback, and a bigint overload can be added later without breaking a caller, if a use turns up; the proposal's `Iterator.range` takes bigints, and an integer range past 2^53 needs them.
- **No mapper option**: `range(n).map(fn)` replaces `Array.from({ length: n }, (_, i) => fn(i))`.
- **No lazy form**: `range` returns an array; a caller who wants an iterator uses `Iterator.range` once it ships.

## Comparison

The tiers 0–2 summary from [research/results/range.md](../../research/results/range.md), generated by `pnpm research`.

- A probe runs only the cases its call can express: Ramda's `range` and Java's `IntStream.range` take no step, remeda's and the proposal's no one-argument form, Go's `range` only a count, and the JVM languages only `int`s with a nonzero step; only `Iterator.range` takes `inclusive`, and no tool takes `fallback` or `range(end, options)`.
- A tool with a one-argument form gets a one-argument case as that form, such as `_.range(4)`.
- A probe that builds item by item (`Iterator.range`, radash, Go, Python's `list`, and the JVM languages) skips a case that would build more than 10,000 items or never end, and the libraries that size or grow a real array skip one between 10,000 and the `2 ** 32` array limit, past which they throw `RangeError` on their own; radash's `list`, which adds the step up, also skips a step that isn't positive or is smaller than the gap between floats at that magnitude, and any case that isn't all numbers.
- Options that can't be read are run only by `Iterator.range`, which takes the object whole; every other call takes `step` as an argument, so the probe would fail reading it before the library ever saw it.
- PostgreSQL's `generate_series` and GNU `seq`, in [the full results](../../research/results/range.md#every-tool), include the end, print `0.3`, not `0.30000000000000004`, and never count down without a step; `seq 4` starts at `1`, PostgreSQL computes in `numeric`, so a value a float can't hold shows as its text (`"4503599627370496.5"`), and an integer past the safe range shows as a bigint.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`range` | core-js<br>`Array.from(Iterator.range(start, end, option))` | es-toolkit<br>`range(start, end, step)` | lodash<br>`_.range(start, end, step)` | radash<br>`list(start, end, undefined, step)` | Ramda<br>`range(from, to)` | remeda<br>`range(start, { end, step })` | Underscore<br>`_.range(start, stop, step)` | Go<br>`for i := range end` | Groovy<br>`(start..<end).step(step)` | Java<br>`IntStream.range(start, end).boxed().toList()` | Kotlin<br>`(start until end step step).toList()` | Python<br>`list(range(start, stop, step))` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `4` | `[0, 1, 2, 3]` | — | `[0, 1, 2, 3]` | `[0, 1, 2, 3]` | `[0, 1, 2, 3, 4]` | — | — | `[0, 1, 2, 3]` | `[0, 1, 2, 3]` | — | — | — | `[0, 1, 2, 3]` |
| `0` | `[]` | — | `[]` | `[]` | `[0]` | — | — | `[]` | `[]` | — | — | — | `[]` |
| `-3` | `[]` | — | `[]` | `[0, -1, -2]` | `[]` | — | — | `[0, -1, -2]` | `[]` | — | — | — | `[]` |
| `2.5` | `[0, 1, 2]` | — | `[0, 1, 2]` | `[0, 1, 2]` | `[0, 1, 2]` | — | — | `[0, 1, 2]` | — | — | — | — | 💥 `TypeError` |
| `1, 4` | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3, 4]` | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3]` | — | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3]` |
| `4, 1` | `[4, 3, 2]` | `[4, 3, 2]` | `[]` | `[4, 3, 2]` | `[]` | `[]` | `[]` | `[4, 3, 2]` | — | `[4, 3, 2]` | `[]` | `[]` | `[]` |
| `4, 0` | `[4, 3, 2, 1]` | `[4, 3, 2, 1]` | `[]` | `[4, 3, 2, 1]` | `[0]` | `[]` | `[]` | `[4, 3, 2, 1]` | — | `[4, 3, 2, 1]` | `[]` | `[]` | `[]` |
| `4, 0, { "inclusive": true }` | `[4, 3, 2, 1, 0]` | `[4, 3, 2, 1, 0]` | — | — | — | — | — | — | — | — | — | — | — |
| `4, 0, { "step": 1 }` | `[]` | `[]` | `[]` | `[]` | `[0]` | — | `[]` | `[]` | — | `[4, 3, 2, 1]` | — | `[]` | `[]` |
| `4, 0, { "step": -1 }` | `[4, 3, 2, 1]` | `[4, 3, 2, 1]` | `[4, 3, 2, 1]` | `[4, 3, 2, 1]` | — | — | `[4, 3, 2, 1]` | `[4, 3, 2, 1]` | — | `[1, 2, 3, 4]` | — | 💥 `IllegalArgumentException` | `[4, 3, 2, 1]` |
| `-2, 2` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1, 2]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | — | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` | `[-2, -1, 0, 1]` |
| `3, 3` | `[]` | `[]` | `[]` | `[]` | `[3]` | `[]` | `[]` | `[]` | — | `[]` | `[]` | `[]` | `[]` |
| `-0, 2` | `[0, 1]` | `[0, 1]` | `[0, 1]` | `[-0, 1]` | `[-0, 1, 2]` | `[0, 1]` | `[-0, 1]` | `[-0, 1]` | — | — | — | — | 💥 `TypeError` |
| `0.5, 3` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | `[0.5, 1.5, 2.5]` | — | — | — | — | 💥 `TypeError` |
| `0, 10, { "step": 3 }` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | — | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | — | `[0, 3, 6, 9]` | — | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` |
| `4, 1, { "step": -1 }` | `[4, 3, 2]` | `[4, 3, 2]` | `[4, 3, 2]` | `[4, 3, 2]` | — | — | `[4, 3, 2]` | `[4, 3, 2]` | — | `[2, 3, 4]` | — | 💥 `IllegalArgumentException` | `[4, 3, 2]` |
| `1, 4, { "step": -1 }` | `[]` | `[]` | `[]` | `[]` | — | — | `[]` | `[]` | — | `[3, 2, 1]` | — | 💥 `IllegalArgumentException` | `[]` |
| `1, 4, { "step": 1.5 }` | `[1, 2.5]` | `[1, 2.5]` | 💥 `Error` | `[1, 2.5]` | `[1, 2.5, 4]` | — | `[1, 2.5]` | `[1, 2.5]` | — | — | — | — | 💥 `TypeError` |
| `1, 0, { "step": -0.25 }` | `[1, 0.75, 0.5, 0.25]` | `[1, 0.75, 0.5, 0.25]` | 💥 `Error` | `[1, 0.75, 0.5, 0.25]` | — | — | `[1, 0.75, 0.5, 0.25]` | `[1, 0.75, 0.5, 0.25]` | — | — | — | — | 💥 `TypeError` |
| `0, 1, { "step": 0.1 }` | `[0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5, 0.6000000000000001, 0.7000000000000001, 0.8, 0.9]` | `[0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5, 0.6000000000000001, 0.7000000000000001, 0.8, 0.9]` | 💥 `Error` | `[0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5, 0.6, 0.7, 0.7999999999999999, 0.8999999999999999]` | `[0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5, 0.6, 0.7, 0.7999999999999999, 0.8999999999999999, 0.9999999999999999]` | — | `[0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5, 0.6000000000000001, 0.7000000000000001, 0.8, 0.9]` | `[0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5, 0.6, 0.7, 0.7999999999999999, 0.8999999999999999]` | — | — | — | — | 💥 `TypeError` |
| `0, 0.3, { "step": 0.1 }` | `[0, 0.1, 0.2]` | `[0, 0.1, 0.2]` | 💥 `Error` | `[0, 0.1, 0.2]` | `[0, 0.1, 0.2]` | — | `[0, 0.1, 0.2]` | `[0, 0.1, 0.2]` | — | — | — | — | 💥 `TypeError` |
| `0, 4, { "inclusive": true }` | `[0, 1, 2, 3, 4]` | `[0, 1, 2, 3, 4]` | — | — | — | — | — | — | — | — | — | — | — |
| `3, 3, { "inclusive": true }` | `[3]` | `[3]` | — | — | — | — | — | — | — | — | — | — | — |
| `0, 9, { "inclusive": true, "step": 3 }` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | — | — | — | — | — | — | — | — | — | — | — |
| `0, 10, { "inclusive": true, "step": 3 }` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | — | — | — | — | — | — | — | — | — | — | — |
| `0, 0.3, { "inclusive": true, "step": 0.1 }` | `[0, 0.1, 0.2]` | `[0, 0.1, 0.2]` | — | — | — | — | — | — | — | — | — | — | — |
| `0, 4, { "step": 0 }` | `[]` | — | 💥 `Error` | `[0, 0, 0, 0]` | — | — | 💥 `RangeError` | `[0, 1, 2, 3]` | — | — | — | — | 💥 `ValueError` |
| `0, 0, { "step": 0 }` | `[]` | — | 💥 `Error` | `[]` | — | — | 💥 `RangeError` | `[]` | — | — | — | — | 💥 `ValueError` |
| `0, 4, { "step": NaN }` | `[]` | 💥 `RangeError` | 💥 `Error` | `[0, 0, 0, 0]` | — | — | `[]` | `[0, 1, 2, 3]` | — | — | — | — | 💥 `TypeError` |
| `0, 4, { "step": Infinity }` | `[]` | 💥 `RangeError` | 💥 `Error` | `[0]` | `[0]` | — | `[]` | `[]` | — | — | — | — | 💥 `TypeError` |
| `NaN` | `[]` | — | 💥 `RangeError` | `[]` | — | — | — | `[]` | — | — | — | — | 💥 `TypeError` |
| `0, NaN` | `[]` | 💥 `RangeError` | 💥 `RangeError` | `[]` | — | `[]` | `[]` | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `Infinity` | `[]` | — | 💥 `RangeError` | 💥 `RangeError` | — | — | — | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `0, Infinity` | `[]` | — | 💥 `RangeError` | 💥 `RangeError` | — | 💥 `RangeError` | 💥 `RangeError` | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `-Infinity, 0` | `[]` | — | 💥 `RangeError` | 💥 `RangeError` | — | 💥 `RangeError` | 💥 `RangeError` | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `0, 4294967296` | `[]` | — | 💥 `RangeError` | 💥 `RangeError` | — | 💥 `RangeError` | 💥 `RangeError` | 💥 `RangeError` | — | — | — | — | — |
| `9007199254740989, 9007199254740991` | `[9007199254740989, 9007199254740990]` | `[9007199254740989, 9007199254740990]` | `[9007199254740989, 9007199254740990]` | `[9007199254740989, 9007199254740990]` | `[9007199254740989, 9007199254740990, 9007199254740991]` | `[9007199254740989, 9007199254740990]` | `[9007199254740989, 9007199254740990]` | `[9007199254740989, 9007199254740990]` | — | — | — | — | `[9007199254740989, 9007199254740990]` |
| `-9007199254740991, -9007199254740989` | `[-9007199254740991, -9007199254740990]` | `[-9007199254740991, -9007199254740990]` | `[-9007199254740991, -9007199254740990]` | `[-9007199254740991, -9007199254740990]` | `[-9007199254740991, -9007199254740990, -9007199254740989]` | `[-9007199254740991, -9007199254740990]` | `[-9007199254740991, -9007199254740990]` | `[-9007199254740991, -9007199254740990]` | — | — | — | — | `[-9007199254740991, -9007199254740990]` |
| `9007199254740991, 9007199254740994` | `[]` | `[9007199254740991, 9007199254740992, 9007199254740992]` | `[9007199254740991, 9007199254740992, 9007199254740992]` | `[9007199254740991, 9007199254740992, 9007199254740992]` | — | `[9007199254740991, 9007199254740992, 9007199254740992]` | `[9007199254740991, 9007199254740992, 9007199254740992]` | `[9007199254740991, 9007199254740992, 9007199254740992]` | — | — | — | — | 💥 `TypeError` |
| `4503599627370496, 4503599627370498, { "step": 0.5 }` | `[]` | `[4503599627370496, 4503599627370496, 4503599627370497]` | 💥 `Error` | `[4503599627370496, 4503599627370496, 4503599627370496, 4503599627370496]` | — | — | `[4503599627370496, 4503599627370496, 4503599627370497, 4503599627370498]` | `[4503599627370496, 4503599627370496, 4503599627370496, 4503599627370496]` | — | — | — | — | 💥 `TypeError` |
| `1152921504606847000, 1152921504606851000, { "step": 1024 }` | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000]` | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000]` | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000]` | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000]` | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000, 1152921504606851000]` | — | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000]` | `[1152921504606847000, 1152921504606848000, 1152921504606849000, 1152921504606850000]` | — | — | — | — | 💥 `TypeError` |
| `-9007199254740991, 9007199254740991, { "step": 1e-200 }` | `[]` | — | 💥 `Error` | 💥 `RangeError` | — | — | 💥 `RangeError` | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `0, 1.7976931348623157e+308` | `[]` | — | 💥 `RangeError` | 💥 `RangeError` | — | 💥 `RangeError` | 💥 `RangeError` | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `-1.7976931348623157e+308, 1.7976931348623157e+308, { "step": 1.7976931348623157e+308 }` | `[-1.7976931348623157e+308, 0]` | `[-1.7976931348623157e+308, 0]` | 💥 `RangeError` | 💥 `RangeError` | `[-1.7976931348623157e+308, 0, 1.7976931348623157e+308]` | — | 💥 `RangeError` | 💥 `RangeError` | — | — | — | — | 💥 `TypeError` |
| `0, 1.5e-323, { "step": 5e-324 }` | `[0, 5e-324, 1e-323]` | `[0, 5e-324, 1e-323]` | 💥 `Error` | `[0, 5e-324, 1e-323]` | `[0, 5e-324, 1e-323, 1.5e-323]` | — | `[0, 5e-324, 1e-323]` | `[0, 5e-324, 1e-323]` | — | — | — | — | 💥 `TypeError` |
| `1n, 4n` | `[]` | `[1n, 2n, 3n]` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | — | — | — | `[1, 2, 3]` |
| `"3"` | `[]` | — | `[0, 1, 2]` | `[0, 1, 2]` | — | — | — | `[0, 1, 2]` | — | — | — | — | 💥 `TypeError` |
| `null` | `[]` | — | `[]` | `[]` | — | — | — | `[]` | — | — | — | — | 💥 `TypeError` |
| `` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — |
| `0, 4, { "step": "1" }` | `[]` | 💥 `TypeError` | 💥 `Error` | `[0, 1, 2, 3]` | — | — | `[0, 1, 2, 3]` | `[0, "01", "011", "0111"]` | — | — | — | — | 💥 `TypeError` |
| `0, 4, ‹a revoked proxy›` | `[]` | 💥 `TypeError` | — | — | — | — | — | — | — | — | — | — | — |
| `0, 4, ‹a proxy whose get trap throws›` | `[]` | 💥 `Error` | — | — | — | — | — | — | — | — | — | — | — |
| `NaN, { "fallback": null }` | `null` | — | — | — | — | — | — | — | — | — | — | — | — |
| `-3, { "fallback": null }` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — |
| `0, { "fallback": null }` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — |
| `0, 0, { "fallback": null }` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — |
| `1, 4, { "fallback": null, "step": -1 }` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — |
| `0, 4, { "fallback": null, "step": 0 }` | `null` | — | — | — | — | — | — | — | — | — | — | — | — |
| `0, 4294967296, { "fallback": null }` | `null` | — | — | — | — | — | — | — | — | — | — | — | — |
| `4503599627370496, 4503599627370498, { "fallback": null, "step": 0.5 }` | `null` | — | — | — | — | — | — | — | — | — | — | — | — |
| `0, 4, { "fallback": null, "step": "1" }` | `null` | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- **`end` excluded:** every tool compared excludes it except radash's `list`, PostgreSQL's `generate_series`, and `seq`, and an excluded end makes `range(items.length)` exactly the indexes of `items`.
- **Counting down without a step, as the proposal does:** `Iterator.range`, lodash, Underscore, and Groovy count down when `start > end`; es-toolkit, remeda, Ramda, Python, Java, Kotlin, Go, PostgreSQL, and `seq` give `[]`.
  - Following the proposal keeps `range` a drop-in for the native API it's shaped after, and for lodash and Underscore.
  - The risk is a count that goes negative: with lodash, `_.range(count - 1)` is `[0]` when `count` is `0`, and `_.range(-3)` is `[0, -1, -2]`. The proposal has no one-argument form, so `range(end)` stays a count, as `Array.from({ length })` is, and that call is `[]`.
  - In the sample below, `-1` is the most common literal step, though lodash would infer it.
- **`start + i * step`:** lodash and Underscore add the step up, so `range(0, 1, { step: 0.1 })` drifts to `0.8999999999999999`, and radash's `list` adds an eleventh value, `0.9999999999999999`; the proposal, es-toolkit, and remeda multiply.
- **A fallback rather than a throw or a guess:**
  - es-toolkit throws `Error` for a step that isn't a non-zero integer, so `range(1, 4, 1.5)` throws; remeda and Python throw on a zero step, and the proposal on a `NaN` bound or step, an infinite step, or a step of the wrong type;
  - lodash turns a zero or `NaN` step into `[0, 0, 0, 0]`, and Underscore treats a zero step as `1`;
  - lodash, es-toolkit, and Underscore coerce `"3"` into `[0, 1, 2]`, and Underscore's step of `"1"` concatenates strings, `[0, "01", "011", "0111"]`;
  - radash's `list` reads an `end` of `0` as missing, so `list(0)` is `[0]`, and loops forever on a step that isn't positive;
  - past the safe-integer limit, the proposal, es-toolkit, lodash, Ramda, remeda, and Underscore all give `[…991, …992, …992]`;
  - at `2 ** 52` with a half step, lodash and Underscore never leave `2 ** 52`, the proposal repeats it, and remeda repeats it and includes the excluded end, while radash's `list` would never end, so it doesn't run.
- **`[]` as the default fallback:** a range is usually looped over or mapped at once, so `[]` needs no check at the call site, and `fallback` lets a caller who must tell "nothing to count" from "can't count" ask for it, as every other export's `fallback` does.
- **2^24:** the largest literal `end` sampled below is `2022`, and the rest are expressions; the cap keeps a span computed by mistake, such as a timestamp in place of a count, from taking the process down, which no `try` can do.
- **No bigint:** no literal sampled below is one, and `Number`'s safe integers cover every array index.

The call samples behind "nearly half the `_.range` calls" and the steps above, from `pnpm research:usage calls _.range --argument 2` and `--argument 3`:

Argument 2, `end`, where `(none)` is the one-argument form:

| Argument     | Calls | Share (%) |
| :----------- | ----: | --------: |
| (none)       |   294 |      46.4 |
| (expression) |   238 |      37.6 |
| 10           |    23 |       3.6 |
| 24           |     7 |       1.1 |
| 5            |     7 |       1.1 |
| 25           |     4 |       0.6 |
| 60           |     4 |       0.6 |
| (cut off)    |     3 |       0.5 |
| -1           |     3 |       0.5 |
| 2            |     3 |       0.5 |
| 6            |     3 |       0.5 |
| 90           |     3 |       0.5 |
| 1000         |     2 |       0.3 |
| 12           |     2 |       0.3 |
| 13           |     2 |       0.3 |
| 180          |     2 |       0.3 |
| 21           |     2 |       0.3 |
| 3            |     2 |       0.3 |
| 31           |     2 |       0.3 |
| 32           |     2 |       0.3 |
| 4            |     2 |       0.3 |
| 7            |     2 |       0.3 |
| 9            |     2 |       0.3 |
| 0            |     1 |       0.2 |
| 1.0          |     1 |       0.2 |
| 1.001        |     1 |       0.2 |
| 100          |     1 |       0.2 |
| 1001         |     1 |       0.2 |
| 104          |     1 |       0.2 |
| 123          |     1 |       0.2 |
| 126          |     1 |       0.2 |
| 127          |     1 |       0.2 |
| 19           |     1 |       0.2 |
| 20           |     1 |       0.2 |
| 2020         |     1 |       0.2 |
| 2022         |     1 |       0.2 |
| 204          |     1 |       0.2 |
| 30           |     1 |       0.2 |
| 50           |     1 |       0.2 |
| 75           |     1 |       0.2 |
| 91           |     1 |       0.2 |
| 925          |     1 |       0.2 |

- **Method**: GitHub code search for `_.range` in JavaScript and TypeScript, up to the top 300 files per language: 590 files sampled of 73,944 matching, holding 633 calls.
- **Collected**: 2026-10-31
- **Caveats**:
  - The sample is GitHub's top-ranked files for the query, not a random sample.
  - Only calls inside GitHub's text-match fragments are seen; a call that runs past a fragment's edge counts as `(cut off)`.
  - Definitions (`function parseInt(`, a method followed by `{`, a typed signature followed by `:`) and calls inside comments or strings are skipped, while calls inside a template's `${…}` count; a fragment that starts mid-string can't be told apart, so a few such calls may still count.
  - A literal argument is reported as written; anything else is `(expression)`.

Argument 3, `step`:

| Argument     | Calls | Share (%) |
| :----------- | ----: | --------: |
| (none)       |   582 |      91.9 |
| (expression) |    22 |       3.5 |
| -1           |     6 |       0.9 |
| 10           |     5 |       0.8 |
| (cut off)    |     3 |       0.5 |
| 0            |     3 |       0.5 |
| 1            |     3 |       0.5 |
| 5            |     3 |       0.5 |
| 8            |     2 |       0.3 |
| 0.001        |     1 |       0.2 |
| 0.1          |     1 |       0.2 |
| 25           |     1 |       0.2 |
| 4            |     1 |       0.2 |

- **Method**: GitHub code search for `_.range` in JavaScript and TypeScript, up to the top 300 files per language: 590 files sampled of 73,944 matching, holding 633 calls.
- **Collected**: 2026-10-31
- **Caveats**:
  - The sample is GitHub's top-ranked files for the query, not a random sample.
  - Only calls inside GitHub's text-match fragments are seen; a call that runs past a fragment's edge counts as `(cut off)`.
  - Definitions (`function parseInt(`, a method followed by `{`, a typed signature followed by `:`) and calls inside comments or strings are skipped, while calls inside a template's `${…}` count; a fragment that starts mid-string can't be told apart, so a few such calls may still count.
  - A literal argument is reported as written; anything else is `(expression)`.

## Consequences

- The docs show `range(n).map(fn)` for `Array.from({ length: n }, fn)`, `range(10).map((i) => i / 10)` for exact decimal steps, `Math.max` for a computed pair that must not count down, and `{ fallback: undefined }` for telling bad input from an empty range.
- The docs say that `range(start, end)` counts down when `start > end` while `range(end)` never does, and that more than 2^24 items returns the fallback.
- The implementation's tests cover each fallback case above, including a revoked-proxy options object and the repeated-value step, and its type tests check that `range(5, { step: 2 })` and `range(1n, 4n)` are compile errors and that `fallback` widens the return type.
- A benchmark compares it with `Array.from({ length })`, lodash, and es-toolkit on `range(1000)`, per [the performance decision](performance.md).
