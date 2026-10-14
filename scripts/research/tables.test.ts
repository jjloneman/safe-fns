import { describe, expect, test } from "vitest";

import type { FunctionResult, ResultColumn } from "./results.ts";

import { renderResultMarkdown } from "./tables.ts";

const column = (overrides: Partial<ResultColumn>): ResultColumn => ({
  call: "f(value)",
  image: "img@sha256:1",
  locale: "C.UTF-8",
  name: "tool",
  outcomes: [],
  service: "node",
  tier: 1,
  version: "1.0.0",
  ...overrides,
});

describe("renderResultMarkdown", () => {
  test("groups cases by the planned column's values, then other values, then throws", () => {
    // Given
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

    // When
    const markdown = renderResultMarkdown(result);

    // Then
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
    // Given
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

    // When
    const markdown = renderResultMarkdown(result);
    const summary = markdown.slice(0, markdown.indexOf("## By outcome"));
    const full = markdown.slice(markdown.indexOf("## Every tool"));

    // Then
    expect(summary).toContain("near");
    expect(summary).not.toContain("far");
    expect(full).toContain("far");
    expect(full).toContain(
      "| far<br>`f(value)` | 3 | `1.0.0` | `C.UTF-8` | `img@sha256:1` |"
    );
  });

  test("groups by every column's values when there is no plan", () => {
    // Given
    const result: FunctionResult = {
      cases: [["a"]],
      columns: [column({ outcomes: [{ kind: "value", value: 1 }] })],
      function: "f",
    };

    // When
    const markdown = renderResultMarkdown(result);

    // Then
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
    // Given
    const result: FunctionResult = {
      cases: outcomes.map(() => ["a"]),
      columns: [column({ outcomes })],
      function: "f",
    };

    // When
    const markdown = renderResultMarkdown(result);

    // Then
    expect(markdown).not.toContain("## By outcome");
  });

  test("escapes pipes and backticks, and marks a missing outcome", () => {
    // Given
    const result: FunctionResult = {
      cases: [["a|b"], ["`"]],
      columns: [column({ outcomes: [{ kind: "value", value: "x" }] })],
      function: "f",
    };

    // When
    const markdown = renderResultMarkdown(result);

    // Then
    expect(markdown).toContain(
      String.raw`| ${"`"}"a\|b"${"`"} | ${"`"}"x"${"`"} |`
    );
    expect(markdown).toContain('| `` "`" `` | — |');
  });
});
