import { describe, expect, test } from "vitest";

import type { FoldAuditReport, FoldAuditRow } from "./fold-audit-table.ts";

import { parseFoldAuditReport, renderFoldAudit } from "./fold-audit-table.ts";
import { parseJson } from "./json.ts";

function report(overrides: Partial<FoldAuditReport>): FoldAuditReport {
  return {
    anyAsciiVersion: "0.3.3",
    node: "26.0.0",
    rows: [],
    unfoldable: 10,
    unicode: "16.0",
    ...overrides,
  };
}

function row(overrides: Partial<FoldAuditRow>): FoldAuditRow {
  return {
    anyAscii: "<<",
    category: "Pi",
    codePoint: 0xab,
    folded: "",
    group: "punctuation",
    ...overrides,
  };
}

describe("parseFoldAuditReport", () => {
  test("keeps a well-formed report", () => {
    // Given - a report as the container prints it
    const value = report({ rows: [row({})] });

    // When - parsing it
    const parsed = parseFoldAuditReport(
      parseJson({ source: "the test report", text: JSON.stringify(value) })
    );

    // Then - the same report
    expect(parsed).toStrictEqual(value);
  });

  test.each([
    { description: "a non-object", value: "text" },
    { description: "an array", value: [] },
    { description: "null", value: null },
    {
      description: "rows that aren't an array",
      value: { ...report({}), rows: {} },
    },
    { description: "a missing version", value: { ...report({}), node: 26 } },
    {
      description: "a row that isn't an object",
      value: { ...report({}), rows: [1] },
    },
    {
      description: "a row with an unknown group",
      value: { ...report({}), rows: [{ ...row({}), group: "emoji" }] },
    },
    {
      description: "a row with a non-numeric code point",
      value: { ...report({}), rows: [{ ...row({}), codePoint: "171" }] },
    },
  ])("rejects $description", ({ value }) => {
    // When - parsing it
    const parsed = parseFoldAuditReport(value);

    // Then - nothing
    expect(parsed).toBeUndefined();
  });
});

describe("renderFoldAudit", () => {
  test("writes a summary and a table per group, in group order", () => {
    // Given - one row in two groups
    const value = report({
      rows: [
        row({
          anyAscii: "Ng",
          category: "Lu",
          codePoint: 0x14a,
          group: "letter",
        }),
        row({}),
      ],
    });

    // When - rendering it
    const markdown = renderFoldAudit(value);

    // Then - the summary counts both, and each table holds its row
    expect(markdown).toContain("| Latin letters | 1 |");
    expect(markdown).toContain("| Punctuation | 1 |");
    expect(markdown).toContain("| Spaces | 0 |");
    expect(markdown).toContain("| U+014A | `Ŋ` | Lu | — | `Ng` |");
    expect(markdown).toContain("| U+00AB | `«` | Pi | — | `<<` |");
    expect(markdown.indexOf("## Latin letters")).toBeLessThan(
      markdown.indexOf("## Punctuation")
    );
    expect(markdown.endsWith("|\n")).toBe(true);
  });

  test("escapes invisible characters, pipes, and backticks", () => {
    // Given - a space, a spelling with a pipe, and one with a backtick
    const value = report({
      rows: [
        row({
          anyAscii: " ",
          category: "Zs",
          codePoint: 0xa0,
          folded: " ",
          group: "space",
        }),
        row({ anyAscii: "|", category: "Po", codePoint: 0x2016 }),
        row({ anyAscii: "``", category: "Po", codePoint: 0x2036 }),
      ],
    });

    // When - rendering it
    const markdown = renderFoldAudit(value);

    // Then - each cell stays inside its column
    expect(markdown).toContain("| U+00A0 | `\\u{A0}` | Zs | ` ` | ` ` |");
    expect(markdown).toContain("| U+2016 | `‖` | Po | — | `\\|` |");
    expect(markdown).toContain("| U+2036 | `‶` | Po | — | `` `` `` |");
  });
});
