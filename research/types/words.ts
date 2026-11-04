/*
 * The type-level word splitter the planned case types share, as the
 * package's `src/internal/` module will be, following
 * `docs/decisions/case-conversion.md` on ASCII.
 *
 * - Written in the syntax TypeScript 4.9 parses: no `const` type parameters,
 *   no `NoInfer`.
 *
 * - A character outside printable ASCII widens the result to `string`, since
 *   template-literal types have no `\p{…}` classes to split it the way the
 *   runtime does.
 */

/** Drop every apostrophe from a word, as the runtime joins words. */
export type WithoutApostrophes<Word extends string> =
  Word extends `${infer Before}'${infer After}`
    ? WithoutApostrophes<`${Before}${After}`>
    : Word;

/**
 * Split `Text` into its words, or `string[]` when it isn't a literal or holds
 * a character outside printable ASCII.
 */
export type Words<Text extends string> = string extends Text
  ? string[]
  : Text extends unknown
    ? SplitWords<Text, [], "", "separator">
    : never;

/** How the splitter treats one character; `"unknown"` is outside ASCII. */
type CharacterKind<Character extends string> = Character extends LowerLetter
  ? "lower"
  : Character extends Uppercase<LowerLetter>
    ? "upper"
    : Character extends "'" | Digit
      ? "caseless"
      : Character extends Separator
        ? "separator"
        : Character extends SymbolCharacter
          ? "symbol"
          : "unknown";

/** An ASCII digit, which stays on the word before it. */
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** An ASCII lowercase letter. */
type LowerLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

/** Append a finished word, skipping an empty one. */
type PushWord<Done extends string[], Word extends string> = Word extends ""
  ? Done
  : [...Done, Word];

/** ASCII whitespace and punctuation but the apostrophe, which end a word. */
type Separator =
  | '"'
  | "_"
  | "-"
  | ","
  | ";"
  | ":"
  | "!"
  | "?"
  | "."
  | " "
  | "("
  | ")"
  | "["
  | "]"
  | "{"
  | "}"
  | "@"
  | "*"
  | "/"
  | "\\"
  | "\f"
  | "\n"
  | "\r"
  | "\t"
  | "\v"
  | "&"
  | "#"
  | "%";

/**
 * Split the rest of `Text`, one character at a time, into `Done`.
 *
 * - Each state is its own type parameter, never an object, so every step
 *   resolves before the next and a long key stays within TypeScript's
 *   tail-recursion limit.
 */
type SplitWords<
  Text extends string,
  Done extends string[],
  Word extends string,
  Previous extends string,
> = Text extends `${infer Character}${infer Rest}`
  ? CharacterKind<Character> extends infer Kind extends string
    ? Kind extends "unknown"
      ? string[]
      : Kind extends "separator"
        ? SplitWords<Rest, PushWord<Done, Word>, "", Kind>
        : Kind extends "symbol"
          ? Previous extends "symbol"
            ? SplitWords<Rest, Done, `${Word}${Character}`, Kind>
            : SplitWords<Rest, PushWord<Done, Word>, Character, Kind>
          : StartsWord<Kind, Previous, Rest> extends true
            ? SplitWords<Rest, PushWord<Done, Word>, Character, Kind>
            : SplitWords<Rest, Done, `${Word}${Character}`, Kind>
    : never
  : PushWord<Done, Word>;

/**
 * Whether a letter or digit of `Kind` starts a new word: after a symbol, an
 * uppercase letter after a lowercase letter or digit, or an acronym's last
 * capital before a lowercase letter.
 */
type StartsWord<
  Kind extends string,
  Previous extends string,
  Rest extends string,
> = Previous extends "symbol"
  ? true
  : Kind extends "upper"
    ? Previous extends "caseless" | "lower"
      ? true
      : Previous extends "upper"
        ? Rest extends `${LowerLetter}${string}`
          ? true
          : false
        : false
    : false;

/** An ASCII symbol, which forms a word of its own with the symbols beside it. */
type SymbolCharacter = "`" | "^" | "+" | "<" | "=" | ">" | "|" | "~" | "$";
