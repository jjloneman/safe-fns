/*
 * `CamelCaseKeys`, as `docs/decisions/case-keys.md` plans it, checked by
 * `pnpm research:types` against every consumer TypeScript version.
 */

import type { CamelCase } from "./camel-case";
import type { BuiltInLeaf, Primitive } from "./leaf";

/**
 * Convert every string key of `T` to camel case, at any depth, as
 * `camelCaseKeys` converts the value.
 *
 * - Distributes over unions, and keeps `any`, `unknown`, primitives,
 *   functions, built-ins, and the caller's `Leaf` types whole.
 *
 * - Maps arrays and tuples item by item, and keeps each property's `?` and
 *   `readonly`.
 *
 * - Two keys that convert to one name merge their value types, since the
 *   runtime's winner depends on key order the type doesn't track.
 *
 * @typeParam T - The type whose keys to convert.
 * @typeParam Leaf - Types kept whole, never walked into.
 */
export type CamelCaseKeys<T, Leaf = never> = unknown extends T
  ? T
  : T extends BuiltInLeaf | Leaf | Primitive
    ? T
    : T extends readonly unknown[]
      ? { [K in keyof T]: CamelCaseKeys<T[K], Leaf> }
      : {
          [K in keyof T as K extends string ? CamelCase<K> : K]: CamelCaseKeys<
            T[K],
            Leaf
          >;
        };
