/*
 * `PartialDeep`, as `docs/decisions/type-helpers.md` plans it, checked by
 * `pnpm research:types` against every consumer TypeScript version.
 *
 * - Written in the syntax TypeScript 4.9 parses: no `const` type parameters,
 *   no `NoInfer`.
 */

import type { BuiltInLeaf, Primitive } from "./leaf";

/**
 * Make every property of `T` optional, at any depth.
 *
 * - Distributes over unions, so `Address | null` becomes a partial `Address`
 *   or `null`.
 *
 * - Keeps functions and built-ins whole, and maps arrays and tuples item by
 *   item without changing their length or `readonly`.
 *
 * @typeParam T - The type to make partial.
 * @typeParam Leaf - Types kept whole, never walked into.
 */
export type PartialDeep<T, Leaf = never> = unknown extends T
  ? T
  : T extends BuiltInLeaf | Leaf | Primitive
    ? T
    : T extends readonly unknown[]
      ? { [K in keyof T]: PartialDeep<T[K], Leaf> }
      : { [K in keyof T]?: PartialDeep<T[K], Leaf> };
