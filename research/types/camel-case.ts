/*
 * `CamelCase`, as `docs/decisions/case-keys.md` plans it, checked by
 * `pnpm research:types` against every consumer TypeScript version.
 */

import type { WithoutApostrophes, Words } from "./words";

/**
 * Convert a string literal type to camel case, as `camelCase` converts the
 * value.
 *
 * - Distributes over unions; `string`, or a literal holding a character
 *   outside printable ASCII, is `string`.
 *
 * @typeParam Text - The string type to convert.
 */
export type CamelCase<Text extends string> = Text extends unknown
  ? string[] extends Words<Text>
    ? string
    : JoinCamel<Words<Text>>
  : never;

/** Append each word to `Joined`, capitalized, as camel case's later words. */
type AppendCapitalized<
  Parts extends string[],
  Joined extends string,
> = Parts extends [infer First extends string, ...infer Rest extends string[]]
  ? AppendCapitalized<
      Rest,
      `${Joined}${Capitalize<Lowercase<WithoutApostrophes<First>>>}`
    >
  : Joined;

/**
 * Join words as camel case: the first lowercased, the rest capitalized, each
 * step a tail call, so a long key stays within TypeScript's recursion limit.
 */
type JoinCamel<Parts extends string[]> = Parts extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? AppendCapitalized<Rest, Lowercase<WithoutApostrophes<First>>>
  : "";
