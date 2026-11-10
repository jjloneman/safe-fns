/*
 * The tag vocabulary for the decision records in `docs/decisions/`, a reader
 * for a record's `tags` line, and the generated tag index in its `index.md`.
 *
 * - The vocabulary is fixed on purpose: adding a tag is a reviewed change to
 *   this file, followed by `pnpm okf:tags` to regenerate the index.
 *
 * - A family tag names a function family exactly as its `area:` GitHub label
 *   does, minus the emoji; every other tag names a concern that cuts across
 *   families.
 */

import {
  COMMENT,
  readRecordTitle,
  splitFrontmatter,
} from "./okf-frontmatter.ts";

/** Ends the generated tag index in `docs/decisions/index.md`. */
export const TAG_INDEX_END = "<!-- tag-index:end -->";

/** Starts the generated tag index in `docs/decisions/index.md`. */
export const TAG_INDEX_START = "<!-- tag-index:start -->";

/** The line under a tag that no record carries yet. */
const NO_RECORDS_LINE = "  - _No records yet._";

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
 * - The meanings are rendered into `docs/decisions/index.md` by
 *   `pnpm okf:tags`, so edit them here, not there.
 */
export const DECISION_TAGS = {
  "api-shape": "How an export's signature, options, and types are laid out.",
  case: "Word splitting and case conversion; `area: 🔠 case`.",
  "cross-realm": "Values from another realm, such as an iframe or `node:vm`.",
  dates: "Dates, timestamps, and durations, in any family.",
  encoding: "Base64 and URI component encoding; `area: 🔐 encoding`.",
  errors: "Error helpers that read a thrown value; `area: 🚨 errors`.",
  fallback:
    "What an export returns instead of throwing, where that is the decision.",
  guards: "Type guards and emptiness checks; `area: 🛡️ guards`.",
  "hostile-input": "Proxies, throwing getters, cycles, and `__proto__` keys.",
  naming: "How an export or a type is named.",
  numbers: "Numeric parsing, rounding, and ranges, in any family.",
  objects:
    "Object copy, merge, keying, and key conversion; `area: 🧱 objects`.",
  parse: "Parsers that turn `unknown` into a typed value; `area: 🔍 parse`.",
  performance: "Speed, allocation, and bundle size.",
  scope: "What the package does and does not ship.",
  serialize: "Serializers, clones, and date writers; `area: 📦 serialize`.",
  sort: "Sorting helpers; `area: 🔀 sort`.",
  storage: "Web storage wrappers; `area: 💾 storage`.",
  strings: "String trimming, folding, and text helpers; `area: 🔤 strings`.",
  types: "Types-only helpers; `area: 🏷️ types`.",
  unicode: "Code points, grapheme clusters, normalization, and case.",
  urls: "Query-string readers; `area: 🔗 urls`.",
  utilities:
    "Logger, range, durations, and other utilities; `area: 🧰 utilities`.",
} as const;

/** A tag from the fixed vocabulary. */
export type DecisionTag = keyof typeof DECISION_TAGS;

/** What `replaceTagIndex` needs: the index file and the index to put in it. */
export type ReplaceTagIndexParams = {
  /**
   * The generated index, from `buildTagIndex`.
   *
   * @example "- `parse` — Parsers…"
   */
  index: string;

  /**
   * The whole `index.md` text, markers included.
   *
   * @example `"## Tag vocabulary\n\n<!-- tag-index:start -->…"`
   */
  text: string;
};

/** One decision record, as the tag index lists it. */
export type TaggedRecord = {
  /**
   * The record's file name inside the bundle.
   *
   * @example "safe-parse-number.md"
   */
  fileName: string;

  /**
   * The record's tags, in the order its frontmatter lists them.
   *
   * @example ["numbers", "parse"]
   */
  tags: readonly string[];

  /**
   * The record's title, or its file name when it has none.
   *
   * @example "What safeParseNumber and safeParseInt accept"
   */
  title: string;
};

/** What `toTaggedRecord` needs: a record's file name and its text. */
export type ToTaggedRecordParams = {
  /**
   * The whole record, frontmatter included.
   *
   * @example `"---\ntitle: …\ntags: [parse]\n---\n"`
   */
  text: string;
} & Pick<TaggedRecord, "fileName">;

/** The tag names, as a set for lookups by any string. */
const DECISION_TAG_NAMES: ReadonlySet<string> = new Set(
  Object.keys(DECISION_TAGS)
);

/**
 * Build the tag index: every tag in vocabulary order with its meaning, then a
 * link to each record that carries it.
 *
 * - Records under a tag sort by file name, which follows the function name.
 *
 * - A tag no record carries yet still appears, so the index doubles as the
 *   vocabulary.
 *
 * @param records - every record in the bundle.
 * @returns the index as Markdown list lines joined by `\n`.
 */
export function buildTagIndex(records: readonly TaggedRecord[]): string {
  return Object.entries(DECISION_TAGS)
    .flatMap(([tag, meaning]) => {
      const links = records
        .filter((record) => record.tags.includes(tag))
        .map(({ fileName, title }) => ({ fileName, title }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName))
        .map(({ fileName, title }) => `  - [${title}](${fileName})`);

      return [
        `- \`${tag}\` — ${meaning}`,
        ...(links.length > 0 ? links : [NO_RECORDS_LINE]),
      ];
    })
    .join("\n");
}

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

/**
 * Put a generated tag index between the markers in an index file's text.
 *
 * - Keeps the file's line break, so a CRLF checkout stays CRLF.
 *
 * @returns the new text, or `undefined` when either marker is missing or the
 * end marker comes first.
 */
export function replaceTagIndex(
  params: ReplaceTagIndexParams
): string | undefined {
  const { index, text } = params;
  const end = text.indexOf(TAG_INDEX_END);
  const lineBreak = text.includes("\r\n") ? "\r\n" : "\n";
  const start = text.indexOf(TAG_INDEX_START);

  if (start === -1 || end < start) {
    return undefined;
  }

  const block = [TAG_INDEX_START, "", index, "", ""]
    .join("\n")
    .replaceAll("\n", lineBreak);

  return `${text.slice(0, start)}${block}${text.slice(end)}`;
}

/**
 * Read what the tag index needs from one record.
 *
 * - A record with no tags is listed under none; the guard test reports it.
 *
 * @returns the record's file name, tags, and title.
 */
export function toTaggedRecord(params: ToTaggedRecordParams): TaggedRecord {
  const { fileName, text } = params;

  return {
    fileName,
    tags: readRecordTags(text) ?? [],
    title: readRecordTitle(text) ?? fileName,
  };
}
