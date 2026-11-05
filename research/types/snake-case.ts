/*
 * `SnakeCase`, as `docs/decisions/case-keys.md` plans it, checked by
 * `pnpm research:types` against every consumer TypeScript version.
 */

import type { WithoutApostrophes, Words } from "./words";

/**
 * Convert a string literal type to snake case, as `snakeCase` converts the
 * value.
 *
 * - Distributes over unions; `string`, or a literal holding a character
 *   outside printable ASCII, is `string`.
 *
 * @typeParam Text - The string type to convert.
 */
export type SnakeCase<Text extends string> = Text extends unknown
  ? string[] extends Words<Text>
    ? string
    : JoinSnake<Words<Text>>
  : never;

/** Append each word to `Joined`, lowercased, after an underscore. */
type AppendSnake<
  Parts extends string[],
  Joined extends string,
> = Parts extends [infer First extends string, ...infer Rest extends string[]]
  ? AppendSnake<Rest, `${Joined}_${Lowercase<WithoutApostrophes<First>>}`>
  : Joined;

/**
 * Join lowercased words with underscores, each step a tail call, so a long
 * key stays within TypeScript's recursion limit.
 */
type JoinSnake<Parts extends string[]> = Parts extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? AppendSnake<Rest, Lowercase<WithoutApostrophes<First>>>
  : "";
