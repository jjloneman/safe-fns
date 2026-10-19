import { describe, expect, test } from "vitest";

import type { CodeSearchItem, UsageReport } from "./usage-tally.ts";

import {
  buildCallReport,
  buildCountReport,
  buildDownloadReport,
  buildFileReport,
  CAVEATS_BY_MODE,
  CUT_OFF_LABEL,
  EXPRESSION_LABEL,
  isRateLimited,
  isUsageMode,
  NO_ARGUMENT_LABEL,
  parsePositiveInteger,
  renderReportMarkdown,
  tallyCalls,
  TIMEOUT_CAVEAT,
  toCodeSearchPage,
  toLanguageQualifier,
  toNpmDownloads,
  toNpmDownloadsUrl,
  uniqueIgnoringCase,
} from "./usage-tally.ts";

function item(overrides: Partial<CodeSearchItem>): CodeSearchItem {
  return {
    fragments: [],
    path: "src/a.ts",
    repository: "owner/repo",
    url: "https://github.com/owner/repo/blob/main/src/a.ts",
    ...overrides,
  };
}

describe("tallyCalls", () => {
  test("labels literals as written and everything else by kind", () => {
    // Given - calls with a number, strings, a keyword, an expression, no
    // argument, and one cut off
    const items = [
      item({
        fragments: [
          "parseInt(a, 10); parseInt(b, 10); parseInt(c)",
          "parseInt(d, '8'); parseInt(e, \"8\"); parseInt(f, `2`)",
          "parseInt(g, undefined); parseInt(h, base); parseInt(i, -1)",
          "parseInt(j, ",
        ],
      }),
    ];

    // When - tallying the second argument
    const rows = tallyCalls({ argumentPosition: 2, callee: "parseInt", items });

    // Then - most common first, ties in code-unit order
    expect(rows).toStrictEqual([
      { count: 2, label: "10" },
      { count: 1, label: '"8"' },
      { count: 1, label: "'8'" },
      { count: 1, label: CUT_OFF_LABEL },
      { count: 1, label: EXPRESSION_LABEL },
      { count: 1, label: NO_ARGUMENT_LABEL },
      { count: 1, label: "-1" },
      { count: 1, label: "`2`" },
      { count: 1, label: "undefined" },
    ]);
  });

  test("labels a multi-line template literal as an expression", () => {
    // Given - a template literal spanning two lines
    const items = [item({ fragments: ["parseInt(a, `1\n0`)"] })];

    // When - tallying the second argument
    const rows = tallyCalls({ argumentPosition: 2, callee: "parseInt", items });

    // Then - its label can't break a table row
    expect(rows).toStrictEqual([{ count: 1, label: EXPRESSION_LABEL }]);
  });

  test("labels a template literal with a substitution as an expression", () => {
    // Given - a template literal that interpolates
    const items = [item({ fragments: ["parseInt(a, `${base}`)"] })];

    // When - tallying the second argument
    const rows = tallyCalls({ argumentPosition: 2, callee: "parseInt", items });

    // Then - it isn't a literal
    expect(rows).toStrictEqual([{ count: 1, label: EXPRESSION_LABEL }]);
  });
});

describe("buildCallReport", () => {
  test("counts each file once and reports shares and the sample", () => {
    // Given - the same file returned twice, a second file, and a timeout
    const repeated = item({ fragments: ["parseInt(a, 10)"] });

    const other = item({
      fragments: ["parseInt(b, 10); parseInt(c, 16); parseInt(d)"],
      url: "https://github.com/owner/repo/blob/main/src/b.ts",
    });

    // When - building the report
    const report = buildCallReport({
      argumentPosition: 2,
      callee: "parseInt",
      collected: "2026-10-19",
      isIncomplete: true,
      items: [repeated, other, repeated],
      languages: ["JavaScript", "TypeScript"],
      pages: 3,
      totalCount: 1_520_000,
    });

    // Then - the duplicate is dropped, the method says how it sampled, and
    // the timeout is flagged
    expect(report).toStrictEqual({
      caveats: [...CAVEATS_BY_MODE.calls, TIMEOUT_CAVEAT],
      collected: "2026-10-19",
      columns: ["Argument", "Calls", "Share (%)"],
      method:
        "GitHub code search for `parseInt` in JavaScript and TypeScript, up to the top 300 files per language: 2 files sampled of 1,520,000 matching, holding 4 calls.",
      mode: "calls",
      rows: [
        { Argument: "10", Calls: 2, "Share (%)": 50 },
        { Argument: NO_ARGUMENT_LABEL, Calls: 1, "Share (%)": 25 },
        { Argument: "16", Calls: 1, "Share (%)": 25 },
      ],
      title: "`parseInt` argument 2",
    } satisfies UsageReport);
  });
});

describe("buildCountReport", () => {
  test("gives every language a column and a total, names in the order given", () => {
    // Given - two names counted in two languages
    const counts = [
      { language: "TypeScript", name: "safeParseJson", totalCount: 5 },
      { language: "JavaScript", name: "safeParseJson", totalCount: 7 },
      { language: "TypeScript", name: "safeJsonParse", totalCount: 9 },
      { language: "JavaScript", name: "safeJsonParse", totalCount: 11 },
    ].map((count) => ({ ...count, isIncomplete: false }));

    // When - building the report
    const report = buildCountReport({ collected: "2026-10-19", counts });

    // Then - one row per name, one column per language, then their total
    expect(report.columns).toStrictEqual([
      "Name",
      "TypeScript",
      "JavaScript",
      "Total",
    ]);
    expect(report.rows).toStrictEqual([
      { JavaScript: 7, Name: "safeParseJson", Total: 12, TypeScript: 5 },
      { JavaScript: 11, Name: "safeJsonParse", Total: 20, TypeScript: 9 },
    ]);
    expect(report.caveats).toStrictEqual(CAVEATS_BY_MODE.counts);
  });

  test("prefixes a language named like a fixed column", () => {
    // Given - a language called Total beside a real one
    const counts = [
      { language: "Total", name: "safeJsonParse", totalCount: 2 },
      { language: "TypeScript", name: "safeJsonParse", totalCount: 9 },
    ].map((count) => ({ ...count, isIncomplete: false }));

    // When - building the report
    const report = buildCountReport({ collected: "2026-10-19", counts });

    // Then - its column can't clash with the real Total
    expect(report.columns).toStrictEqual([
      "Name",
      "language:Total",
      "TypeScript",
      "Total",
    ]);
    expect(report.rows).toStrictEqual([
      {
        "language:Total": 2,
        Name: "safeJsonParse",
        Total: 11,
        TypeScript: 9,
      },
    ]);
  });

  test("totals a repeated language once", () => {
    // Given - the same language counted twice beside another
    const counts = [
      { language: "TypeScript", name: "safeJsonParse", totalCount: 9 },
      { language: "TypeScript", name: "safeJsonParse", totalCount: 9 },
      { language: "JavaScript", name: "safeJsonParse", totalCount: 11 },
    ].map((count) => ({ ...count, isIncomplete: false }));

    // When - building the report
    const report = buildCountReport({ collected: "2026-10-19", counts });

    // Then - the total adds each language column once
    expect(report.rows).toStrictEqual([
      { JavaScript: 11, Name: "safeJsonParse", Total: 20, TypeScript: 9 },
    ]);
  });

  test("counts every language in one column and flags a timed-out count", () => {
    // Given - a count without a language that GitHub marked incomplete
    const counts = [
      {
        isIncomplete: true,
        language: undefined,
        name: "safeJsonParse",
        totalCount: 72_600,
      },
    ];

    // When - building the report
    const report = buildCountReport({ collected: "2026-10-19", counts });

    // Then - a single Files column, and a caveat about the timeout
    expect(report.columns).toStrictEqual(["Name", "Files"]);
    expect(report.rows).toStrictEqual([
      { Files: 72_600, Name: "safeJsonParse" },
    ]);
    expect(report.caveats.at(-1)).toBe(TIMEOUT_CAVEAT);
  });
});

describe("buildDownloadReport", () => {
  test("names the week and marks an unknown package", () => {
    // Given - one known package and one npm doesn't know
    const downloads = [
      {
        downloads: 68_035_196,
        end: "2026-10-16",
        package: "dequal",
        start: "2026-10-10",
      },
    ];

    // When - building the report
    const report = buildDownloadReport({
      collected: "2026-10-19",
      downloads,
      packages: ["dequal", "no-such-package"],
    });

    // Then - the unknown package keeps its row
    expect(report.method).toBe(
      "npm's downloads API, 2026-10-10 to 2026-10-16."
    );
    expect(report.rows).toStrictEqual([
      { Package: "dequal", "Weekly downloads": 68_035_196 },
      { Package: "no-such-package", "Weekly downloads": "not found" },
    ]);
  });

  test("falls back to a generic week when no package was found", () => {
    // Given/When - a report with no known package
    const report = buildDownloadReport({
      collected: "2026-10-19",
      downloads: [],
      packages: ["no-such-package"],
    });

    // Then - the method can't name dates
    expect(report.method).toBe("npm's downloads API, last week.");
  });
});

describe("buildFileReport", () => {
  test.each([
    { description: "a complete search", extraCaveats: [], isIncomplete: false },
    {
      description: "a timed-out search",
      extraCaveats: [TIMEOUT_CAVEAT],
      isIncomplete: true,
    },
  ])("lists every file for $description", ({ extraCaveats, isIncomplete }) => {
    // Given/When - a search that found one of two files
    const report = buildFileReport({
      collected: "2026-10-19",
      isIncomplete,
      items: [item({})],
      query: "foo repo:owner/repo",
      totalCount: 2,
    });

    // Then - one row per file, and the method names the query
    expect(report.rows).toStrictEqual([
      {
        Path: "src/a.ts",
        Repository: "owner/repo",
        URL: "https://github.com/owner/repo/blob/main/src/a.ts",
      },
    ]);
    expect(report.method).toBe(
      "GitHub code search for `foo repo:owner/repo`: the top 1 of 2 matching files."
    );
    expect(report.caveats).toStrictEqual([
      ...CAVEATS_BY_MODE.files,
      ...extraCaveats,
    ]);
  });
});

describe("isRateLimited", () => {
  test.each([
    {
      description: "a secondary rate limit",
      isLimited: true,
      message: "gh: You have exceeded a secondary rate limit (HTTP 403)",
    },
    {
      description: "the primary rate limit",
      isLimited: true,
      message: "gh: API rate limit exceeded for user ID 1. (HTTP 403)",
    },
    {
      description: "any other error",
      isLimited: false,
      message: "gh: Validation Failed (HTTP 422)",
    },
  ])("reads $description", ({ isLimited, message }) => {
    // Given/When/Then - only a rate limit is retried
    expect(isRateLimited(message)).toBe(isLimited);
  });
});

describe("isUsageMode", () => {
  test.each([
    { description: "a mode", isMode: true, value: "counts" },
    { description: "an unknown word", isMode: false, value: "count" },
    { description: "no argument", isMode: false, value: undefined },
  ])("reads $description", ({ isMode, value }) => {
    // Given/When/Then - only the four modes are accepted
    expect(isUsageMode(value)).toBe(isMode);
  });
});

describe("parsePositiveInteger", () => {
  test.each([
    { description: "an absent flag", expected: 3, text: undefined },
    { description: "a number in range", expected: 10, text: "10" },
    { description: "zero", expected: undefined, text: "0" },
    { description: "a number over the max", expected: undefined, text: "11" },
    { description: "a fraction", expected: undefined, text: "1.5" },
    { description: "a word", expected: undefined, text: "ten" },
  ])("reads $description", ({ expected, text }) => {
    // Given/When/Then - only a whole number from 1 to the max is accepted
    expect(parsePositiveInteger({ fallback: 3, max: 10, text })).toBe(expected);
  });
});

describe("renderReportMarkdown", () => {
  test("renders the table, method, date, and caveats", () => {
    // Given - a report with a numeric column, a missing cell, and a pipe
    const report: UsageReport = {
      caveats: ["Matching ignores case."],
      collected: "2026-10-19",
      columns: ["Name", "Files"],
      method: "GitHub code search.",
      mode: "counts",
      rows: [{ Files: 72_600, Name: "a|b" }, { Name: "c" }],
      title: "Code search file counts",
    };

    // When - rendering it
    const markdown = renderReportMarkdown(report);

    // Then - numbers right-aligned with separators, the gap as a dash
    expect(markdown).toBe(
      [
        "## Code search file counts",
        "",
        "| Name | Files |",
        "| :--- | ---: |",
        String.raw`| a\|b | 72,600 |`,
        "| c | — |",
        "",
        "- **Method**: GitHub code search.",
        "- **Collected**: 2026-10-19",
        "- **Caveats**:",
        "  - Matching ignores case.",
        "",
      ].join("\n")
    );
  });
});

describe("toCodeSearchPage", () => {
  test("reads files, their repositories, and their text matches", () => {
    // Given - a page whose items do and don't carry text matches
    const response = {
      incomplete_results: false,
      items: [
        {
          html_url: "https://github.com/o/r/blob/main/a.ts",
          path: "a.ts",
          repository: { full_name: "o/r" },
          text_matches: [
            { fragment: "parseInt(x)", property: "content" },
            { fragment: "src/parseInt.ts", property: "path" },
            { fragment: 1, property: "content" },
            null,
          ],
        },
        {
          html_url: "https://github.com/o/r/blob/main/b.ts",
          path: "b.ts",
          repository: { full_name: "o/r" },
        },
      ],
      total_count: 2,
    };

    // When - narrowing it
    const page = toCodeSearchPage(response);

    // Then - only the content fragments that are strings are kept
    expect(page).toStrictEqual({
      isIncomplete: false,
      items: [
        {
          fragments: ["parseInt(x)"],
          path: "a.ts",
          repository: "o/r",
          url: "https://github.com/o/r/blob/main/a.ts",
        },
        {
          fragments: [],
          path: "b.ts",
          repository: "o/r",
          url: "https://github.com/o/r/blob/main/b.ts",
        },
      ],
      totalCount: 2,
    });
  });

  test("reads a timed-out page as incomplete", () => {
    // Given/When - an empty page GitHub marked incomplete
    const page = toCodeSearchPage({
      incomplete_results: true,
      items: [],
      total_count: 0,
    });

    // Then - the flag survives
    expect(page.isIncomplete).toBe(true);
  });

  test.each([
    { description: "a non-object", response: "oops" },
    { description: "a page without items", response: { total_count: 1 } },
    {
      description: "an item without a repository",
      response: { items: [{ html_url: "u", path: "p" }], total_count: 1 },
    },
  ])("rejects $description", ({ response }) => {
    // Given/When/Then - a malformed response fails loudly
    expect(() => toCodeSearchPage(response)).toThrow(/code search/u);
  });
});

describe("toLanguageQualifier", () => {
  test.each([
    {
      description: "a one-word language bare",
      expected: "language:TypeScript",
      language: "TypeScript",
    },
    {
      description: "a language with a space quoted",
      expected: 'language:"Visual Basic .NET"',
      language: "Visual Basic .NET",
    },
  ])("writes $description", ({ expected, language }) => {
    // Given/When/Then - a name with a space stays one qualifier
    expect(toLanguageQualifier(language)).toBe(expected);
  });
});

describe("toNpmDownloadsUrl", () => {
  test.each([
    {
      description: "a plain package",
      expected: "https://api.npmjs.org/downloads/point/last-week/dequal",
      name: "dequal",
    },
    {
      description: "a scoped package, keeping its slash",
      expected:
        "https://api.npmjs.org/downloads/point/last-week/%40ungap/structured-clone",
      name: "@ungap/structured-clone",
    },
    {
      description: "a name with a URL character",
      expected: "https://api.npmjs.org/downloads/point/last-week/foo%23bar",
      name: "foo#bar",
    },
  ])("builds $description", ({ expected, name }) => {
    // Given/When/Then - each part of the name is encoded
    expect(toNpmDownloadsUrl(name)).toBe(expected);
  });
});

describe("uniqueIgnoringCase", () => {
  test("keeps each value's first spelling, in order", () => {
    // Given - a language repeated in another case
    const languages = ["TypeScript", "JavaScript", "typescript"];

    // When/Then - the repeat is dropped
    expect(uniqueIgnoringCase(languages)).toStrictEqual([
      "TypeScript",
      "JavaScript",
    ]);
  });
});

describe("toNpmDownloads", () => {
  test("reads a package's downloads", () => {
    // Given - npm's response for a known package
    const response = {
      downloads: 5,
      end: "2026-10-16",
      package: "dequal",
      start: "2026-10-10",
    };

    // When/Then - every field is kept
    expect(toNpmDownloads(response)).toStrictEqual(response);
  });

  test("reads an unknown package as undefined", () => {
    // Given/When/Then - npm's error body
    expect(
      toNpmDownloads({ error: "package no-such-package not found" })
    ).toBeUndefined();
  });

  test("rejects a response that is neither", () => {
    // Given/When/Then - a malformed response fails loudly
    expect(() => toNpmDownloads({ downloads: "5" })).toThrow(/npm downloads/u);
  });
});
