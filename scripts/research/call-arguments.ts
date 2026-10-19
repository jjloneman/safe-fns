/*
 * Finds a function's calls in a fragment of JavaScript-like source and splits
 * their arguments, for `pnpm research:usage calls`.
 *
 * - It's a scanner, not a parser: it knows brackets, strings, template
 *   interpolations, comments, and regex literals, which is enough to split the
 *   calls GitHub's text matches show, and reports a call it can't finish
 *   rather than guessing.
 */

/** Characters that close a bracket opened inside a call's arguments. */
const CLOSERS: ReadonlySet<string> = new Set([")", "]", "}"]);

/**
 * A line's text before a definition whose return type follows its `)`: only
 * whitespace and modifiers, as in a class body or a `.d.ts` signature.
 */
const DEFINITION_PREFIX_PATTERN =
  /^\s*(?:(?:abstract|async|declare|export|get|override|private|protected|public|readonly|set|static)\s+)*$/u;

/** Characters that open a bracket inside a call's arguments. */
const OPENERS: ReadonlySet<string> = new Set(["(", "[", "{"]);

/** Characters that open a string, whose contents are skipped. */
const QUOTES: ReadonlySet<string> = new Set(["'", '"', "`"]);

/** Keywords after which a `/` starts a regex, as in `return /x/.test(s)`. */
const REGEX_KEYWORDS: ReadonlySet<string> = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

/**
 * Characters after which a `/` starts a regex literal, not a division.
 *
 * - `<` is left out: in JSX, `</td>` is far more common than `a < /re/`.
 */
const REGEX_PRECEDERS: ReadonlySet<string> = new Set([
  "-",
  ",",
  ";",
  ":",
  "!",
  "?",
  "(",
  "[",
  "{",
  "}",
  "*",
  "&",
  "%",
  "^",
  "+",
  "=",
  ">",
  "|",
  "~",
]);

/** Characters with a meaning in a regular expression. */
const REGEX_SPECIAL_PATTERN = /[$()*+.?[\\\]^{|}]/gu;

/** A line of a block comment's body: a `*`, then a space or the line's end. */
const STAR_LINE_PATTERN = /^\s*\*(?:\s|$)/u;

/** The identifier, if any, that a piece of text ends with. */
const TRAILING_WORD_PATTERN = /[\w$]*$/u;

/** A typed parameter, which only a signature has: `radix?: number`. */
const TYPED_PARAMETER_PATTERN = /^[\w$]+\??\s*:/u;

/** One whitespace character. */
const WHITESPACE_PATTERN = /\s/u;

/** A function to find the calls of, and the text to search. */
export type CallSplitInput = {
  /**
   * The function name, as written before `(`.
   *
   * @example "parseInt"
   */
  callee: string;

  /**
   * The source text to search.
   *
   * @example "const n = parseInt(text, 10);"
   */
  fragment: string;
};

/** Where a call's arguments start, and the text holding it. */
type ArgumentSplitInput = {
  /**
   * The index just after the call's `(`.
   *
   * @example 9
   */
  start: number;

  /**
   * The text holding the call.
   *
   * @example "parseInt(text, 10)"
   */
  text: string;
};

/** Where a scan of code starts, and what it records. */
type CodeScanInput = {
  /**
   * Whether the scan is inside a template's `${…}`, so it ends at the `}`
   * that closes it.
   *
   * @example false
   */
  isInterpolation: boolean;

  /**
   * Where to start.
   *
   * @example 0
   */
  start: number;
} & ScanState;

/** A match, the call it starts, and the text holding both. */
type DefinitionInput = {
  /**
   * The call's arguments and where it ends.
   *
   * @example `{ callArguments: ["text: string"], end: 30 }`
   */
  split: SplitCall;
} & Position;

/** Where a string or regex literal's body starts, and what closes it. */
type LiteralScanInput = {
  /**
   * The character that closes the literal.
   *
   * @example "\""
   */
  closer: string;

  /**
   * The index just after the opening character.
   *
   * @example 10
   */
  start: number;
} & ScanState;

/** A position in some text. */
type Position = {
  /**
   * The index of the character.
   *
   * @example 14
   */
  index: number;

  /**
   * The text holding it.
   *
   * @example "const a = 1; // parseInt(x, 16)"
   */
  text: string;
};

/** The text a scan walks, and where it marks the characters that are code. */
type ScanState = {
  /**
   * Set to `true` at each index that holds code, as a scan reaches it.
   *
   * @example `[true, true, false]`
   */
  codeMask: boolean[];

  /**
   * The text being scanned.
   *
   * @example "parseInt(x, /a/)"
   */
  text: string;
};

/** The span a scan skips, and whether it was a comment. */
type SkippedSpan = {
  /**
   * The index just past the span, or `Infinity` when the text ends inside it.
   *
   * @example 17
   */
  end: number;

  /**
   * Whether the span is a comment, which is dropped from its argument.
   *
   * @example true
   */
  isComment: boolean;
};

/** One call's arguments, and where the call ends. */
type SplitCall = {
  /**
   * The trimmed arguments, comments dropped.
   *
   * @example `["text", "10"]`
   */
  callArguments: string[];

  /**
   * The index just past the call's closing `)`.
   *
   * @example 18
   */
  end: number;
};

/** Whether some text holds any whitespace. @returns it. */
export function hasWhitespace(text: string): boolean {
  return WHITESPACE_PATTERN.test(text);
}

/**
 * Find every call to `callee` in a fragment and split its arguments.
 *
 * - The callee must start a word, so `myParseInt(` isn't a `parseInt` call,
 *   but a member call such as `Number.parseInt(` is.
 *
 * - A match inside a comment or string isn't a call; one inside a template's
 *   `${…}` is.
 *
 * - A definition isn't a call: `function parseInt(`, a method followed by `{`,
 *   and a signature with typed parameters followed by `:`.
 *
 * - Brackets nest and strings are skipped, so `f(g(a, b), "c,d")` has two
 *   arguments.
 *
 * @returns each call's trimmed arguments, or `undefined` for one the fragment
 *   cuts off before its closing parenthesis.
 */
export function splitCalls({
  callee,
  fragment,
}: CallSplitInput): (string[] | undefined)[] {
  const codeMask = findCodeMask(fragment);
  const escaped = callee.replaceAll(REGEX_SPECIAL_PATTERN, String.raw`\$&`);

  const callPattern = new RegExp(
    String.raw`(?<![\w$])(?<!\bfunction\s+)${escaped}\s*\(`,
    "gu"
  );

  return [...fragment.matchAll(callPattern)]
    .filter(({ index }) => codeMask[index])
    .map((match) => ({
      index: match.index,
      split: splitArguments({
        start: match.index + match[0].length,
        text: fragment,
      }),
    }))
    .filter(
      ({ index, split }) =>
        split === undefined || !isDefinition({ index, split, text: fragment })
    )
    .map(({ split }) => split?.callArguments);
}

/**
 * Whether a `/` at `index` starts a regex literal rather than a division: it
 * follows an operator or opening bracket, a keyword such as `return`, or
 * nothing at all.
 *
 * @returns it.
 */
function canStartRegex({ index, text }: Position): boolean {
  const before = text.slice(0, index).trimEnd();
  const last = before.at(-1);

  if (last === undefined || REGEX_PRECEDERS.has(last)) {
    return true;
  }

  return REGEX_KEYWORDS.has(before.slice(before.search(TRAILING_WORD_PATTERN)));
}

/**
 * Mark which characters of a fragment are code, not comment or string.
 *
 * - A fragment can start inside a block comment, so the text before a
 *   comment close found in code, or before a leading run of `*` lines, is a
 *   comment too.
 *
 * @returns one flag per character.
 */
function findCodeMask(text: string): boolean[] {
  const codeMask = Array.from({ length: text.length }, () => false);

  scanCode({ codeMask, isInterpolation: false, start: 0, text });

  const leadingClose = codeMask.findIndex(
    (isCode, index) => isCode && text.startsWith("*/", index)
  );

  const leadingCommentEnd =
    leadingClose === -1 ? findStarLinesEnd(text) : leadingClose + 2;

  return codeMask.map((isCode, index) => isCode && index >= leadingCommentEnd);
}

/**
 * Find where a string, template, or regex literal ends.
 *
 * - A backslash escapes the next character; in a regex, a `/` inside a
 *   character class doesn't close it.
 *
 * - A template's `${…}` is scanned as code, so a backtick or brace inside it
 *   doesn't end the template.
 *
 * - Only a template spans lines, so a newline inside any other literal means
 *   the opening character wasn't one: an apostrophe in JSX text, or a
 *   division misread as a regex.
 *
 * @returns the index just past the closing character, `Infinity` when the
 *   text ends first, or `undefined` when a newline does.
 */
function findLiteralEnd({
  closer,
  codeMask,
  start,
  text,
}: LiteralScanInput): number | undefined {
  let isInClass = false;

  for (let index = start; index < text.length; index++) {
    const character = text.charAt(index);

    if (character === "\\") {
      index++;
    } else if (closer === "`" && text.startsWith("${", index)) {
      index =
        scanCode({ codeMask, isInterpolation: true, start: index + 2, text }) -
        1;
    } else if (character === "\n" && closer !== "`") {
      return undefined;
    } else if (closer === "/" && (character === "[" || character === "]")) {
      isInClass = character === "[";
    } else if (character === closer && !isInClass) {
      return index + 1;
    }
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Find the span a comment, string, or regex literal starting at `index`
 * covers, which a scan skips whole.
 *
 * @returns the span, or `undefined` when none starts at `index`.
 */
function findSkippedSpan({
  codeMask,
  index,
  text,
}: Position & ScanState): SkippedSpan | undefined {
  const character = text.charAt(index);

  if (text.startsWith("//", index)) {
    const newline = text.indexOf("\n", index);

    return {
      end: newline === -1 ? Number.POSITIVE_INFINITY : newline,
      isComment: true,
    };
  }

  if (text.startsWith("/*", index)) {
    const close = text.indexOf("*/", index + 2);

    return {
      end: close === -1 ? Number.POSITIVE_INFINITY : close + 2,
      isComment: true,
    };
  }

  const isLiteralStart =
    QUOTES.has(character) ||
    (character === "/" && canStartRegex({ index, text }));

  const end = isLiteralStart
    ? findLiteralEnd({ closer: character, codeMask, start: index + 1, text })
    : undefined;

  return end === undefined ? undefined : { end, isComment: false };
}

/**
 * Find where a leading run of block-comment `*` lines ends, for a fragment
 * that starts inside a doc comment whose close it doesn't reach.
 *
 * @returns the index just past the run, or 0 when the first line isn't one.
 */
function findStarLinesEnd(text: string): number {
  const lines = text.split("\n");
  const firstCodeLine = lines.findIndex(
    (line) => !STAR_LINE_PATTERN.test(line)
  );

  return lines
    .slice(0, firstCodeLine === -1 ? lines.length : firstCodeLine)
    .reduce((end, line) => end + line.length + 1, 0);
}

/**
 * Whether a match is a definition rather than a call: its `)` is followed by
 * a body's `{`, or by a return type's `:` when its parameters are typed (or
 * there are none) and nothing but modifiers precede it on its line.
 *
 * - The typed-parameter check keeps a call in a multi-line ternary, such as
 *   `parseInt(x, 16) :` on a line of its own.
 *
 * @returns it.
 */
function isDefinition({ index, split, text }: DefinitionInput): boolean {
  const following = text.slice(split.end).trimStart().charAt(0);

  if (following === "{") {
    return true;
  }

  const hasTypedParameters =
    split.callArguments.length === 0 ||
    split.callArguments.some((parameter) =>
      TYPED_PARAMETER_PATTERN.test(parameter)
    );

  const linePrefix = text.slice(text.lastIndexOf("\n", index - 1) + 1, index);

  return (
    following === ":" &&
    hasTypedParameters &&
    DEFINITION_PREFIX_PATTERN.test(linePrefix)
  );
}

/**
 * Scan code from `start`, marking each code character in `codeMask` and
 * skipping comments and literals.
 *
 * @returns the index just past the `}` closing an interpolation, or
 *   `Infinity` when the text ends first.
 */
function scanCode({
  codeMask,
  isInterpolation,
  start,
  text,
}: CodeScanInput): number {
  let depth = 0;

  // A character-by-character walk, since each span decides where the next can
  // start.
  for (let index = start; index < text.length; index++) {
    const character = text.charAt(index);
    const span = findSkippedSpan({ codeMask, index, text });

    if (span !== undefined) {
      index = span.end - 1;
    } else if (character === "}" && depth === 0 && isInterpolation) {
      return index + 1;
    } else {
      codeMask[index] = true;
      depth += Number(character === "{") - Number(character === "}");
    }
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Split a call's arguments, starting just after its opening parenthesis.
 *
 * - Comments, strings, templates, and regex literals are skipped whole, so a
 *   comma or bracket inside one neither splits nor closes the call, and a
 *   comment is dropped from the argument it sits in.
 *
 * - A `/` starts a regex only where an operand can begin (after `(`, `,`, an
 *   operator, `return`, …), so `a / b` stays a division.
 *
 * - A trailing empty argument is dropped, so `f()` has none and `f(a,)` has
 *   one.
 *
 * @returns the trimmed arguments and where the call ends, or `undefined` when
 *   the text ends first.
 */
function splitArguments({
  start,
  text,
}: ArgumentSplitInput): SplitCall | undefined {
  const callArguments: string[] = [];
  let argumentStart = start;
  let argumentText = "";
  let depth = 1;

  // A character-by-character walk is the clearest way to track nesting.
  for (let index = start; index < text.length; index++) {
    const character = text.charAt(index);

    // Only the call's own text is split, so the code mask is thrown away.
    const span = findSkippedSpan({ codeMask: [], index, text });

    if (span?.isComment === true) {
      argumentText += `${text.slice(argumentStart, index)} `;
      argumentStart = span.end;
      index = span.end - 1;
    } else if (span !== undefined) {
      index = span.end - 1;
    } else if (OPENERS.has(character)) {
      depth++;
    } else if (character === "," && depth === 1) {
      callArguments.push(
        `${argumentText}${text.slice(argumentStart, index)}`.trim()
      );
      argumentStart = index + 1;
      argumentText = "";
    } else if (CLOSERS.has(character)) {
      depth--;

      if (depth === 0) {
        const lastArgument =
          `${argumentText}${text.slice(argumentStart, index)}`.trim();

        return {
          callArguments:
            lastArgument === ""
              ? callArguments
              : [...callArguments, lastArgument],
          end: index + 1,
        };
      }
    }
  }

  return undefined;
}
