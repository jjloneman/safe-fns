import { describe, expect, test } from "vitest";

import type { FunctionResult, ResultColumn } from "./results.ts";

import { renderResultMarkdown } from "./tables.ts";

function column(overrides: Partial<ResultColumn>): ResultColumn {
  return {
    call: "f(value)",
    image: "img@sha256:1",
    locale: "C.UTF-8",
    name: "tool",
    outcomes: [],
    service: "node",
    tier: 1,
    version: "1.0.0",
    ...overrides,
  };
}

describe("renderResultMarkdown", () => {
  test("groups cases by the planned column's values, then other values, then throws", () => {
    // Given - a planned column and a tool that returns, differs, and throws
    const result: FunctionResult = {
      cases: [["yes"], ["no"], ["x"], ["?"]],
      columns: [
        column({
          name: "safe-fns (planned)",
          outcomes: [
            { kind: "value", value: true },
            { kind: "value", value: false },
            { kind: "value", value: { $undefined: true } },
            { kind: "n/a" },
          ],
          tier: 0,
        }),
        column({
          outcomes: [
            { kind: "value", value: true },
            { kind: "value", value: 0 },
            { error: "TypeError", kind: "error" },
            { kind: "n/a" },
          ],
        }),
      ],
      function: "f",
    };

    // When - rendering the Markdown
    const markdown = renderResultMarkdown(result);

    // Then - the grouped table sorts each case under its outcome
    expect(markdown).toContain(
      "| Tool | `true` | `false` | `undefined` | Other | Throws |"
    );
    expect(markdown).toContain(
      '| tool<br>`f(value)` | `"yes"` |  |  | `"no"` → `0` | `"x"` |'
    );
    expect(markdown).toContain('| `"x"` | `undefined` | 💥 `TypeError` |');
    expect(markdown).toContain('| `"?"` | — | — |');
  });

  test("shows only tiers 0–2 in the summary, and every tier below", () => {
    // Given - one tier-2 column and one tier-3 column
    const result: FunctionResult = {
      cases: [["a"]],
      columns: [
        column({
          name: "near",
          outcomes: [{ kind: "value", value: 1 }],
          tier: 2,
        }),
        column({
          name: "far",
          outcomes: [{ kind: "value", value: 2 }],
          tier: 3,
        }),
      ],
      function: "f",
    };

    // When - rendering the Markdown
    const markdown = renderResultMarkdown(result);
    const summary = markdown.slice(0, markdown.indexOf("## By outcome"));
    const full = markdown.slice(markdown.indexOf("## Every tool"));

    // Then - the summary drops tier 3, and the full and version tables keep it
    expect(summary).toContain("near");
    expect(summary).not.toContain("far");
    expect(full).toContain("far");
    expect(full).toContain(
      "| far<br>`f(value)` | 3 | `1.0.0` | `C.UTF-8` | `img@sha256:1` |"
    );
  });

  test("groups by every column's values when there is no plan", () => {
    // Given - a single column with no planned column
    const result: FunctionResult = {
      cases: [["a"]],
      columns: [column({ outcomes: [{ kind: "value", value: 1 }] })],
      function: "f",
    };

    // When - rendering the Markdown
    const markdown = renderResultMarkdown(result);

    // Then - its own values head the grouped table
    expect(markdown).toContain("| Tool | `1` | Other | Throws |");
  });

  test.each([
    {
      description: "too many distinct values",
      outcomes: [1, 2, 3, 4, 5].map((value) => ({
        kind: "value" as const,
        value,
      })),
    },
    {
      description: "no values at all",
      outcomes: [{ error: "Error", kind: "error" as const }],
    },
  ])("skips the grouped table for $description", ({ outcomes }) => {
    // Given - a column whose outcomes the grouped table can't use
    const result: FunctionResult = {
      cases: outcomes.map(() => ["a"]),
      columns: [column({ outcomes })],
      function: "f",
    };

    // When - rendering the Markdown
    const markdown = renderResultMarkdown(result);

    // Then - there is no grouped table
    expect(markdown).not.toContain("## By outcome");
  });

  test("escapes pipes and backticks, and marks a missing outcome", () => {
    // Given - cases holding a pipe and a backtick, and a column one outcome short
    const result: FunctionResult = {
      cases: [["a|b"], ["`"]],
      columns: [column({ outcomes: [{ kind: "value", value: "x" }] })],
      function: "f",
    };

    // When - rendering the Markdown
    const markdown = renderResultMarkdown(result);

    // Then - both are escaped, and the missing outcome is a dash
    expect(markdown).toContain(
      String.raw`| ${"`"}"a\|b"${"`"} | ${"`"}"x"${"`"} |`
    );
    expect(markdown).toContain('| `` "`" `` | — |');
  });

  test("marks a docs-only column and names its source instead of its image", () => {
    // Given - a column transcribed from a cached source
    const result: FunctionResult = {
      cases: [["1e3"]],
      columns: [
        column({
          outcomes: [{ kind: "value", value: 1000 }],
          source: "research/sources/excel.md",
        }),
      ],
      function: "f",
    };

    // When - rendering the Markdown
    const markdown = renderResultMarkdown(result);

    // Then - the header is marked, and the version table cites the source
    expect(markdown).toContain('| `"1e3"` | `1000` |');
    expect(markdown).toContain(
      "| tool (docs only)<br>`f(value)` | 1 | `1.0.0` | `C.UTF-8` | `research/sources/excel.md` |"
    );
  });
});
