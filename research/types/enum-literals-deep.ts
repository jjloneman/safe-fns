/*
 * `EnumLiteralsDeep`, as `docs/decisions/type-helpers.md` plans it, checked by
 * `pnpm research:types` against every consumer TypeScript version.
 *
 * - Written in the syntax TypeScript 4.9 parses: no `const` type parameters,
 *   no `NoInfer`.
 */

import type { BuiltInLeaf, Primitive } from "./leaf";

/**
 * Turn each string enum in `T` into its string literal values, at any depth,
 * so `{ day: "Monday" }` is accepted where `{ day: Day }` is expected.
 *
 * - Numeric enums are kept, since a number already type-checks against one.
 *
 * @typeParam T - The type to convert.
 * @typeParam Leaf - Types kept whole, never walked into.
 */
export type EnumLiteralsDeep<T, Leaf = never> = unknown extends T
  ? T
  : T extends string
    ? `${T}`
    : T extends BuiltInLeaf | Leaf | Primitive
      ? T
      : { [K in keyof T]: EnumLiteralsDeep<T[K], Leaf> };
