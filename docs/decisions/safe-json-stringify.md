---
type: Decision
title: How safeJsonStringify handles what JSON.stringify throws on
description: Circular references and BigInts are repaired by default, as "[Circular]" and decimal strings; options change either repair or turn it into the fallback, and anything else JSON.stringify can't serialize returns the fallback.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T03:42:10Z }
---

# How safeJsonStringify handles what JSON.stringify throws on

`safeJsonStringify` produces the same text as `JSON.stringify` whenever that succeeds, and repairs the two failures that are common in real data.

## Decision

- **Signature,** keeping `JSON.stringify`'s own parameters in their native order:

  ```ts
  safeJsonStringify(
    value: unknown,
    replacer?: ((this: unknown, key: string, value: unknown) => unknown) | (number | string)[] | null,
    space?: number | string,
    options?: {
      bigint?: "fallback" | "string";
      circular?: "fallback" | "replace";
      circularPlaceholder?: string;
      fallback?: F;
    },
  ): string | F
  ```

- **Repairs, on by default:**
  - a circular reference is written as `circularPlaceholder`, `"[Circular]"` by default;
  - a BigInt is written as its decimal string (`12n` → `"12"`).
- **Overrides:**
  - `circularPlaceholder` sets the text written for a cycle;
  - `circular: "fallback"` or `bigint: "fallback"` turns that repair off, so the whole call returns the fallback instead.
- **A circular reference is an object that is its own ancestor on the current path.** An object reached twice through different keys isn't a cycle, and is written twice, as `JSON.stringify` does.
- **Anything else that can't be serialized returns the fallback:**
  - a `toJSON`, getter, replacer, or proxy trap that throws;
  - a top-level `undefined`, function, or symbol, where `JSON.stringify` returns `undefined` rather than a string.
- **The fallback defaults to `undefined`,** following [What a parser returns when it can't parse](parser-fallbacks.md).
- **Fast path:** it calls `JSON.stringify` first, and walks the value with cycle tracking only after that throws, so data with no cycles or BigInts costs one native call.

## Why

- The duplication scan found about 237 unguarded `JSON.stringify` call sites in the owner's work code, and none guarded against cycles or BigInts.
- The owner chose repair as the default, so a log line or debug dump always comes out, with overrides for callers who would rather know.
- Repair is what [`safe-stable-stringify`](https://www.npmjs.com/package/safe-stable-stringify) and [`fast-safe-stringify`](https://www.npmjs.com/package/fast-safe-stringify) do, and they have 70M and 53M weekly downloads.
- `replacer` and `space` stay positional because a wrapper keeps the native API's parameter order (see [How a function takes its parameters](function-parameters.md)).

## Consequences

- Repaired output doesn't round-trip: `"[Circular]"` and `"12"` come back from `safeParseJson` as strings.
- Keys keep insertion order; sorted output comes from `safeJsonStringify(deepSortObject(value))`.
