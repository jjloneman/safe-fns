---
type: Decision
title: How predicates are named
description: Predicates start with `is`, name the positive case, and come in positive/negative pairs rather than negated names.
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-30T20:24:01Z }
verified: { by: human:jjloneman, at: 2026-10-05T15:38:06Z }
---

# How predicates are named

A predicate reads as a positive question, starting with `is`.

## Decision

- **`is` comes first:** `isSafeEmpty`, not `safeIsEmpty`.
  - It matches the repo's boolean naming rule (`is` / `has` / `can` / `should`) and the TypeScript convention for type predicates.
  - Typing `is` in an editor lists every predicate together.
  - Existing `isSafeEmpty` / `isSafePopulated` call sites keep working unchanged.
- **Names state the positive case, never a negation.**
  - `isSafePopulated`, not `isNonEmpty` or `isNonBlankString`.
  - Negating a negated name reads as a double negative: `!isNonBlank(value)`.
- **A check that callers need both ways ships as a pair:** `isSafeEmpty` and `isSafePopulated`, so no call site has to write `!isSafeEmpty(value)`.
- **Narrow duplicates are dropped rather than renamed.**
  - `isNonBlankString` and `isNonEmptyArray` aren't shipped.
  - `isSafePopulated` covers a value already typed as a string or array.
  - For an `unknown` value, `typeof value === "string" && isSafePopulated(value)` narrows and checks in one line.

## Why

- The owner wrote `isSafeEmpty` / `isSafePopulated` with `is` first, and finds negated names hard to read.
- Two narrow type guards would have added two names for what one line of `typeof` plus `isSafePopulated` already says.

## Consequences

- The README's planned API table drops `isNonBlankString` and `isNonEmptyArray`, and its migration table swaps a blank-string check for `isSafePopulated`.

## Open

- **Whether `isSafePopulated` narrows the type.**
  - A plain type predicate narrows both branches: for a `string | undefined` declared `value is string`, the `else` branch would narrow to `undefined`, even though `""` lands there too.
  - The options — no narrowing, narrowing away only `null` / `undefined`, or a branded non-empty type — go in `isSafeEmpty`'s own decision.
