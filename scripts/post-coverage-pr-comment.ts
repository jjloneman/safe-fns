/**
 * Renders Vitest's coverage-summary.json as a Markdown table, followed by the
 * `text` reporter's per-file output in a collapsed `<details>` block.
 *
 * - Publishes it via {@link publishCiReport}: the GitHub Actions job summary,
 *   plus (on a pull_request) a sticky PR comment upserted by the report's
 *   heading — so it coexists with the CI timings report's own sticky comment
 *   instead of clobbering it.
 *
 * - Run locally it just prints the table; missing CI env skips the comment. A
 *   failure to post only warns, and a missing or oversized text report
 *   degrades to the table alone — but a bug in the script itself, such as an
 *   unreadable summary, fails the step.
 */

import { readFileSync } from "node:fs";

import { publishCiReport } from "./lib/publish-ci-report.ts";

/** One metric's totals from coverage-summary.json (`lines`, `branches`, …). */
type CoverageMetric = Record<"covered" | "pct" | "total", number>;

/** The `total` block of coverage-summary.json. */
type CoverageTotal = Record<
  "branches" | "functions" | "lines" | "statements",
  CoverageMetric
>;

const SUMMARY_PATH = "coverage/coverage-summary.json";

/**
 * The `text` reporter's per-file table, written by the `["text", { file }]`
 * entry in vitest.config.ts's `coverage.reporter`.
 */
const TEXT_REPORT_PATH = "coverage/coverage.txt";

/** The sticky-comment marker — the report's stable opening heading. */
const REPORT_MARKER = "## 📊 Code coverage";

/**
 * Character budget for the text report inside the comment.
 *
 * - GitHub rejects an issue comment body over 65536 characters, which would
 *   make the upsert fail and drop the whole report — so the per-file table is
 *   truncated well short of it rather than risking that.
 */
const MAX_TEXT_REPORT_CHARS = 50_000;

/**
 * Render one metric as a Markdown table row.
 *
 * - The percentage is floored, never rounded: the gate demands exactly 100%, so
 *   99.95% must not read as a passing "100%".
 */
const metricRow = (label: string, metric: CoverageMetric): string =>
  `| ${label} | ${Math.floor(metric.pct * 10) / 10}% | ${metric.covered}/${metric.total} |`;

/** Build the summary table — the part that always appears. */
const buildTable = (total: CoverageTotal): string =>
  `${REPORT_MARKER}

| Metric | % | Covered |
| :--- | ---: | ---: |
${metricRow("📄 Statements", total.statements)}
${metricRow("🔀 Branches", total.branches)}
${metricRow("⚙️ Functions", total.functions)}
${metricRow("📏 Lines", total.lines)}`;

/**
 * Read the `text` reporter's output.
 *
 * @returns the report, or `undefined` when it is missing or unreadable.
 */
const readTextReport = (): string | undefined => {
  try {
    return readFileSync(TEXT_REPORT_PATH, "utf8").trimEnd();
  } catch (error: unknown) {
    console.warn(
      `[CI] No text coverage report at ${TEXT_REPORT_PATH} — posting the table alone:`,
      error
    );
    return undefined;
  }
};

/** Clip an oversized report to the budget, flagging that it was cut. */
const clipToBudget = (textReport: string): string =>
  textReport.length <= MAX_TEXT_REPORT_CHARS
    ? textReport
    : `${textReport.slice(0, MAX_TEXT_REPORT_CHARS)}\n\n…truncated — see the full table in the CI job log.`;

/**
 * Wrap the per-file report in a collapsed `<details>` block.
 *
 * - The blank lines around the fence are required: GitHub stops parsing
 *   Markdown inside an HTML block without them, so the code fence would render
 *   literally.
 */
const buildDetails = (textReport: string): string =>
  `<details>
<summary>📋 Per-file coverage (<code>text</code> reporter)</summary>

\`\`\`text
${clipToBudget(textReport)}
\`\`\`

</details>`;

const main = (): void => {
  const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8")) as Record<
    "total",
    CoverageTotal
  >;

  const table = buildTable(summary.total);
  const textReport = readTextReport();

  const markdown =
    textReport === undefined
      ? table
      : `${table}

${buildDetails(textReport)}`;

  // Locally the `text` reporter has already printed the per-file table to
  // stdout, so echoing the details block back would just duplicate it.
  publishCiReport({ localConsole: table, markdown, marker: REPORT_MARKER });
};

try {
  main();
} catch (error: unknown) {
  console.error("[CI] Fatal error:", error);
  process.exit(1);
}
