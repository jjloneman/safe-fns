---
type: Decision
title: How safeObjectHasOwn narrows
description: Two overloads — a typed object narrows the key to keyof T, and any other value narrows only the true branch to V & Record<K, unknown>; null, primitives, and trapping proxies return false.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-12T19:30:00Z }
---

# How safeObjectHasOwn narrows

`safeObjectHasOwn(value, key)` is `Object.hasOwn` that never throws, and narrows whichever side the caller doesn't already know.

## Decision

- **Two overloads, tried in this order:**

  ```ts
  declare const ownProperty: unique symbol;
  export type WithOwnProperty<V, K extends PropertyKey> = V & Record<K, unknown> & { readonly [ownProperty]: true };

  safeObjectHasOwn<T extends object>(value: T, key: PropertyKey): key is keyof T;
  safeObjectHasOwn<V, K extends PropertyKey>(value: V, key: K): value is WithOwnProperty<V, K>;
  ```

- **A typed object narrows the key,** for lookup tables read with an untrusted key:

  ```ts
  const LABELS = { draft: "Draft", stable: "Stable" } as const;
  if (safeObjectHasOwn(LABELS, status)) LABELS[status]; // "Draft" | "Stable"
  ```

- **Any other value narrows the object,** for untrusted payloads:

  ```ts
  const body: unknown = await response.json();
  if (safeObjectHasOwn(body, "id")) body.id; // unknown, but readable
  ```

  - It narrows only the true branch, with the same kind of type-only brand (a fake tag property that exists only in the type system) as `isSafePopulated`, so for a `string | { id?: number }` the else branch keeps both members rather than collapsing to `string`.
  - The value's own type is kept: an already-typed value becomes `V & Record<"id", unknown>`, not a bare record.
  - `WithOwnProperty<V, K>` is exported, for the same declaration-emit reason as `Populated<T>`.

- **The key overload stays a plain predicate.** A tagged key can no longer index the object, so `LABELS[status]` would stop compiling.
  - With a `string` key, the main use, the else branch stays `string`.
  - With a key whose literal type is already known (`"draft"`), the else branch becomes `never`; the docs say so.

- **Own properties only,** like `Object.hasOwn`: `"constructor"` and `"toString"` are inherited, so they're `false`, where the `in` operator says `true`.
- **Returns `false` instead of throwing** for `null`, `undefined`, primitives, a revoked proxy, a throwing `getOwnPropertyDescriptor` trap, and a key that isn't a string, number, or symbol.
  - Primitives are `false` even where `Object.hasOwn` would box them (wrap them in a temporary object): `Object.hasOwn("abc", "length")` is `true`. Asking whether a string has an own `length` is almost always a bug, and returning `false` keeps the object narrowing honest.
  - Functions are objects, so `safeObjectHasOwn(fn, "name")` works as natively.

## Why

- The owner asked for real examples of each narrowing, and both turned out to be common: `hasKey`-style payload checks (what the scan found hand-rolled) and lookup tables keyed by query params.
- Native `Object.hasOwn` narrows neither, and its types don't accept `unknown`.
- Both overloads, and each branch's narrowed type, were checked on TypeScript 6.0 and 4.9.

## Consequences

- A value typed as plain `object` matches the key overload, where `keyof object` is `never`; annotate it `unknown` to narrow the object instead.
- Key narrowing trusts `T` to list every own key: an object carrying undeclared keys, from a cast or a wider subtype, can narrow a key it shouldn't, as with ts-extras' `keyIn`.
- A key that isn't a string, number, or symbol returns `false`, where `Object.hasOwn` would coerce it (`Object.hasOwn({ null: 1 }, null)` is `true`).
- On a typed object with an optional property (`{ timeout?: number }`), it narrows the key, not the object, so `options.timeout` stays optional; `options.timeout !== undefined` covers that case.
- It replaces the `hasKey` candidate.
