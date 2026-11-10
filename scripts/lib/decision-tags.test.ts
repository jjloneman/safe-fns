import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { buildRecord } from "#test/okf-record";

import {
  DECISION_TAGS,
  isDecisionTag,
  readRecordTags,
} from "./decision-tags.ts";

const DECISIONS_DIRECTORY = join(import.meta.dirname, "../../docs/decisions");
const INDEX_FILE = "index.md";
const MAX_TAGS = 4;
const NEXT_HEADING = "\n## ";
const VOCABULARY_HEADING = "## Tag vocabulary";
const VOCABULARY_LINE = /^- `(?<tag>[a-z-]+)` — (?<meaning>.+)$/;

const RECORD_FILES = readdirSync(DECISIONS_DIRECTORY).filter(
  (file) => file.endsWith(".md") && file !== INDEX_FILE
);

describe("readRecordTags", () => {
  test("reads a flow-style tags list in order", () => {
    // Given - a record with a tags line
    const text = buildRecord(["type: Decision", "tags: [parsing, numbers]"]);

    // When/Then - the tags come back in order
    expect(readRecordTags(text)).toStrictEqual(["parsing", "numbers"]);
  });

  test("reads a CRLF record", () => {
    // Given - a record with Windows line breaks
    const text = buildRecord(["tags: [parsing, numbers]"]).replaceAll(
      "\n",
      "\r\n"
    );

    // When/Then - the tags read the same as with LF
    expect(readRecordTags(text)).toStrictEqual(["parsing", "numbers"]);
  });

  test("ignores a trailing comment and strips quotes around items", () => {
    // Given - quoted items and a YAML comment after the list
    const text = buildRecord([`tags: ["parsing", 'numbers'] # see the index`]);

    // When/Then - the bare tag names come back
    expect(readRecordTags(text)).toStrictEqual(["parsing", "numbers"]);
  });

  test("reads an empty list as no tags", () => {
    // Given/When/Then - an empty list is an empty array
    expect(readRecordTags(buildRecord(["tags: []"]))).toStrictEqual([]);
  });

  test.each([
    { description: "no tags line", text: buildRecord(["type: Decision"]) },
    { description: "no frontmatter", text: "# Title\n" },
    { description: "an unclosed frontmatter block", text: "---\ntags: [a]\n" },
    {
      description: "a comment with no space before it",
      text: buildRecord(["tags: [a]#x"]),
    },
    {
      description: "a block-style list",
      text: buildRecord(["tags:", "  - a"]),
    },
  ])("returns undefined for $description", ({ text }) => {
    // Given/When/Then - nothing to read
    expect(readRecordTags(text)).toBeUndefined();
  });
});

describe("isDecisionTag", () => {
  test("accepts a tag in the vocabulary and rejects any other", () => {
    // Given/When/Then - one of each
    expect(isDecisionTag("parsing")).toBe(true);
    expect(isDecisionTag("parse")).toBe(false);
  });
});

describe("the index's tag vocabulary", () => {
  test("lists exactly DECISION_TAGS, in order, with the same meanings", () => {
    // Given - the bullets under the vocabulary heading in index.md
    const text = readFileSync(join(DECISIONS_DIRECTORY, INDEX_FILE), "utf8");
    const start = text.indexOf(VOCABULARY_HEADING);
    const end = text.indexOf(NEXT_HEADING, start + VOCABULARY_HEADING.length);
    const section = text.slice(start, end === -1 ? undefined : end);

    // When - reading each tag and its meaning
    const listed = section
      .split(/\r?\n/u)
      .map((line) => VOCABULARY_LINE.exec(line)?.groups)
      .filter((groups) => groups !== undefined)
      .map(({ meaning, tag }) => [tag, meaning]);

    // Then - they match the constant
    expect(text).toContain(VOCABULARY_HEADING);
    expect(listed).toStrictEqual(Object.entries(DECISION_TAGS));
  });
});

describe("every decision record", () => {
  test.each(RECORD_FILES.map((file) => ({ file })))(
    "$file carries tags from the vocabulary",
    ({ file }) => {
      // Given - a record in docs/decisions
      const text = readFileSync(join(DECISIONS_DIRECTORY, file), "utf8");

      // When - reading its tags
      const tags = readRecordTags(text);

      // Then - one to four distinct, sorted tags, all in the vocabulary
      expect(tags).toBeDefined();
      expect(tags?.length).toBeGreaterThan(0);
      expect(tags?.length).toBeLessThanOrEqual(MAX_TAGS);
      expect(new Set(tags).size).toBe(tags?.length);
      expect(tags?.filter((tag) => !isDecisionTag(tag))).toStrictEqual([]);
      expect(tags).toStrictEqual([...(tags ?? [])].sort());
    }
  );
});
