import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { buildRecord } from "#test/okf-record";

import {
  buildTagIndex,
  DECISION_TAGS,
  isDecisionTag,
  readRecordTags,
  replaceTagIndex,
  TAG_INDEX_END,
  TAG_INDEX_START,
  toTaggedRecord,
} from "./decision-tags.ts";

const DECISIONS_DIRECTORY = join(import.meta.dirname, "../../docs/decisions");
const INDEX_FILE = "index.md";
const MAX_TAGS = 4;

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
    expect(isDecisionTag("parse")).toBe(true);
    expect(isDecisionTag("parsing")).toBe(false);
  });
});

describe("buildTagIndex", () => {
  test("lists each tag's records by file name, and marks unused tags", () => {
    // Given - two records under `parse`, one under `numbers`
    const records = [
      { fileName: "b.md", tags: ["parse"], title: "B" },
      { fileName: "a.md", tags: ["numbers", "parse"], title: "A" },
    ];

    // When - building the index
    const index = buildTagIndex(records);

    // Then - records sort by file name, and a tag with none says so
    expect(index).toContain(
      `- \`parse\` — ${DECISION_TAGS.parse}\n  - [A](a.md)\n  - [B](b.md)\n`
    );
    expect(index).toContain(
      `- \`sort\` — ${DECISION_TAGS.sort}\n  - _No records yet._\n`
    );
  });
});

describe("replaceTagIndex", () => {
  test("replaces only the text between the markers", () => {
    // Given - an index file with a stale index
    const text = `# Index\n\n${TAG_INDEX_START}\n\n- old\n\n${TAG_INDEX_END}\n`;

    // When - putting in a new one
    const updated = replaceTagIndex({ index: "- new", text });

    // Then - the markers and surrounding text stay
    expect(updated).toBe(
      `# Index\n\n${TAG_INDEX_START}\n\n- new\n\n${TAG_INDEX_END}\n`
    );
  });

  test("keeps a CRLF file's line breaks", () => {
    // Given - an index file with Windows line breaks
    const text = `${TAG_INDEX_START}\r\n${TAG_INDEX_END}\r\n`;

    // When - putting in a two-line index
    const updated = replaceTagIndex({ index: "- a\n- b", text });

    // Then - every inserted line ends in CRLF
    expect(updated).toBe(
      `${TAG_INDEX_START}\r\n\r\n- a\r\n- b\r\n\r\n${TAG_INDEX_END}\r\n`
    );
  });

  test.each([
    { description: "no start marker", text: `${TAG_INDEX_END}\n` },
    { description: "no end marker", text: `${TAG_INDEX_START}\n` },
    {
      description: "the end marker first",
      text: `${TAG_INDEX_END}\n${TAG_INDEX_START}\n`,
    },
  ])("returns undefined for $description", ({ text }) => {
    // Given/When/Then - nothing to replace
    expect(replaceTagIndex({ index: "- a", text })).toBeUndefined();
  });
});

describe("toTaggedRecord", () => {
  test("reads a record's title and tags", () => {
    // Given - a record with both
    const text = buildRecord(['title: "What X accepts"', "tags: [parse]"]);

    // When/Then - both come back with the file name
    expect(toTaggedRecord({ fileName: "x.md", text })).toStrictEqual({
      fileName: "x.md",
      tags: ["parse"],
      title: "What X accepts",
    });
  });

  test("falls back to the file name and no tags", () => {
    // Given/When/Then - a record without frontmatter
    expect(toTaggedRecord({ fileName: "x.md", text: "# X\n" })).toStrictEqual({
      fileName: "x.md",
      tags: [],
      title: "x.md",
    });
  });
});

describe("docs/decisions/index.md", () => {
  test("holds the current tag index; run pnpm okf:tags if this fails", () => {
    // Given - every record and the index file
    const records = RECORD_FILES.map((fileName) =>
      toTaggedRecord({
        fileName,
        text: readFileSync(join(DECISIONS_DIRECTORY, fileName), "utf8"),
      })
    );
    const text = readFileSync(join(DECISIONS_DIRECTORY, INDEX_FILE), "utf8");

    // When - regenerating the index into it
    const updated = replaceTagIndex({ index: buildTagIndex(records), text });

    // Then - nothing changes
    expect(updated).toBe(text);
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
