/*
 * The tag vocabulary for the decision records in `docs/decisions/`, and a
 * reader for a record's `tags` line.
 *
 * - The vocabulary is fixed on purpose: adding a tag is a reviewed change to
 *   this file and to the list in `docs/decisions/index.md`.
 */

import { COMMENT, splitFrontmatter } from "./okf-frontmatter.ts";

/** One list item wrapped in matching single or double quotes. */
const QUOTED_ITEM = /^(?<quote>["'])(?<inner>.*)\k<quote>$/;

/**
 * A flow-style `tags` line, capturing the text between the brackets.
 *
 * - A trailing YAML comment is allowed and ignored.
 */
const TAGS_LINE = new RegExp(
  String.raw`^tags:\s*\[(?<items>[^\]]*)\](?:${COMMENT})?\s*$`
);

/**
 * Every tag a decision record may carry, each with its one-line meaning.
 *
 * - Keep the names and meanings in step with "Tag vocabulary" in
 *   `docs/decisions/index.md`; a test compares the two.
 */
export const DECISION_TAGS = {
  "api-shape": "How an export's signature, options, and types are laid out.",
  cloning: "Copying values, deeply or through `structuredClone`.",
  collections: "Arrays, objects, `Map`, and `Set`.",
  comparison: "Equality and ordering of values.",
  "cross-realm": "Values from another realm, such as an iframe or `node:vm`.",
  dates: "Dates, timestamps, and durations.",
  encoding: "Text encodings and serialization formats.",
  errors: "Thrown values and how they are read or repaired.",
  fallback: "The caller's fallback returned instead of throwing or guessing.",
  formatting: "Producing text from a value.",
  "hostile-input": "Proxies, throwing getters, cycles, and `__proto__` keys.",
  naming: "How an export or a type is named.",
  numbers: "Numeric parsing, rounding, and ranges.",
  parsing: "Reading a value of a known type out of unknown input.",
  performance: "Speed, allocation, and bundle size.",
  predicates: "Functions that answer a yes-or-no question about a value.",
  scope: "What the package does and does not ship.",
  storage: "`localStorage`, `sessionStorage`, and the like.",
  strings: "Text handling.",
  unicode: "Code points, grapheme clusters, normalization, and case.",
} as const;

/** A tag from the fixed vocabulary. */
export type DecisionTag = keyof typeof DECISION_TAGS;

/** The tag names, as a set for lookups by any string. */
const DECISION_TAG_NAMES: ReadonlySet<string> = new Set(
  Object.keys(DECISION_TAGS)
);

/**
 * Whether a string is a tag from the fixed vocabulary.
 *
 * @param value - the string to check.
 * @returns `true` when the vocabulary lists it.
 */
export function isDecisionTag(value: string): value is DecisionTag {
  return DECISION_TAG_NAMES.has(value);
}

/**
 * Read a record's `tags` list from its frontmatter.
 *
 * - Reads LF or CRLF line breaks, and strips quotes around an item.
 *
 * @param text - the whole record, frontmatter included.
 * @returns the tags in order, or `undefined` when the record has no
 * frontmatter block or no flow-style `tags` line.
 */
export function readRecordTags(text: string): string[] | undefined {
  const block = splitFrontmatter(text);

  if (block === undefined) {
    return undefined;
  }

  for (const line of block.lines) {
    const items = TAGS_LINE.exec(line)?.groups?.items;

    if (items !== undefined) {
      return items
        .split(",")
        .map((item) => item.trim())
        .map((item) => QUOTED_ITEM.exec(item)?.groups?.inner ?? item)
        .filter((item) => item !== "");
    }
  }

  return undefined;
}
