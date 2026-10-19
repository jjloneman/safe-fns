/*
 * The pure half of `pnpm research:usage`: narrowing GitHub's and npm's
 * responses, tallying a call's arguments, and rendering the report.
 *
 * - Everything here is deterministic, so it's tested; the network calls and
 *   their pacing live in `usage-search.ts`.
 */
import { hasWhitespace, splitCalls } from "./call-arguments.ts";
import { isRecord } from "./codec.ts";
import { escapeTableCell } from "./tables.ts";

/** The text a call tally reports for an argument it can't read in full. */
export const CUT_OFF_LABEL = "(cut off)";

/** The text a call tally reports for a non-literal argument. */
export const EXPRESSION_LABEL = "(expression)";

/** Joins a report's languages as prose: "JavaScript and TypeScript". */
const LIST_FORMAT = new Intl.ListFormat("en-US", { type: "conjunction" });

/** A JavaScript-like literal: a number, a quoted string, or a keyword. */
const LITERAL_PATTERN =
  /^(?:-?\d[\w.]*|"[^\n"]*"|'[^\n']*'|`[^\n$`]*`|true|false|null|undefined)$/u;

/** The text a call tally reports for a call without that argument. */
export const NO_ARGUMENT_LABEL = "(none)";

/** The fixed count columns, lowercased, which a language column can't take. */
const RESERVED_COLUMNS: ReadonlySet<string> = new Set([
  "files",
  "name",
  "total",
]);

/** GitHub's word for both its primary and its secondary rate limit. */
const RATE_LIMIT_PATTERN = /rate limit/iu;

/** The caveat a report adds when GitHub timed out on any of its searches. */
export const TIMEOUT_CAVEAT =
  "GitHub timed out on at least one search, so its counts and results may be low.";

/** The modes `pnpm research:usage` runs, each named by its first argument. */
export const USAGE_MODES = {
  calls: "calls",
  counts: "counts",
  files: "files",
  npm: "npm",
} as const;

/** What every report of a mode says about how far to trust its numbers. */
export const CAVEATS_BY_MODE: Readonly<Record<UsageMode, readonly string[]>> = {
  calls: [
    "The sample is GitHub's top-ranked files for the query, not a random sample.",
    `Only calls inside GitHub's text-match fragments are seen; a call that runs past a fragment's edge counts as \`${CUT_OFF_LABEL}\`.`,
    "Definitions (`function parseInt(`, a method followed by `{`, a typed signature followed by `:`) and calls inside comments or strings are skipped, while calls inside a template's `${…}` count; a fragment that starts mid-string can't be told apart, so a few such calls may still count.",
    `A literal argument is reported as written; anything else is \`${EXPRESSION_LABEL}\`.`,
  ],
  counts: [
    "Counts are approximate and change from day to day; cite one with its date, as an order of magnitude.",
    "Matching ignores case.",
    "Without a `language:` qualifier every language counts, so an unprefixed name can collide with another language's API (`parseBoolean` matches Java's `Boolean.parseBoolean`).",
  ],
  files: [
    "Results are GitHub's top-ranked files, from the default branches of the repositories code search indexes.",
  ],
  npm: [
    "Downloads count every install, CI and mirrors included, so they measure reach, not users.",
  ],
};

/** Every mode's name, for checking a command-line argument. */
const USAGE_MODE_NAMES: ReadonlySet<string> = new Set(
  Object.values(USAGE_MODES)
);

/** What a call tally needs to build its report. */
export type CallReportInput = {
  /**
   * The 1-based position of the argument to tally.
   *
   * @example 2
   */
  argumentPosition: number;

  /**
   * The function whose calls are tallied, as it's written before `(`.
   *
   * @example "parseInt"
   */
  callee: string;

  /**
   * The date the numbers were collected, as `YYYY-MM-DD`.
   *
   * @example "2026-10-19"
   */
  collected: string;

  /**
   * Whether GitHub timed out on any of the searches.
   *
   * @example false
   */
  isIncomplete: boolean;

  /**
   * Every file the searches returned, duplicates included.
   *
   * @example `[{ fragments: ["parseInt(x, 10)"], path: "a.ts", repository: "o/r", url: "https://github.com/o/r/blob/main/a.ts" }]`
   */
  items: readonly CodeSearchItem[];

  /**
   * The `language:` qualifiers searched, one query each.
   *
   * @example `["JavaScript", "TypeScript"]`
   */
  languages: readonly string[];

  /**
   * How many pages of 100 were read per language.
   *
   * @example 3
   */
  pages: number;

  /**
   * The matching file count GitHub reported, summed over the languages.
   *
   * @example 1520000
   */
  totalCount: number;
};

/** One file a code search returned. */
export type CodeSearchItem = {
  /**
   * The text-match fragments around each hit, if they were asked for.
   *
   * @example `["const n = parseInt(text, 10);"]`
   */
  fragments: readonly string[];

  /**
   * The file's path in its repository.
   *
   * @example "src/parse.ts"
   */
  path: string;

  /**
   * The repository's `owner/name`.
   *
   * @example "facebook/react"
   */
  repository: string;

  /**
   * The file's page on GitHub, which also identifies it.
   *
   * @example "https://github.com/facebook/react/blob/main/src/parse.ts"
   */
  url: string;
};

/** One page of a code search's results. */
export type CodeSearchPage = {
  /**
   * Whether GitHub timed out and the count may be low.
   *
   * @example false
   */
  isIncomplete: boolean;

  /**
   * The page's files.
   *
   * @example `[]`
   */
  items: readonly CodeSearchItem[];

  /**
   * The number of matching files, across every page.
   *
   * @example 72600
   */
  totalCount: number;
};

/** One exact-name count, in one language or in all of them. */
export type NameCount = {
  /**
   * Whether GitHub timed out and the count may be low.
   *
   * @example false
   */
  isIncomplete: boolean;

  /**
   * The `language:` qualifier, or `undefined` for every language.
   *
   * @example "TypeScript"
   */
  language: string | undefined;

  /**
   * The name searched for, as an exact phrase.
   *
   * @example "safeJsonParse"
   */
  name: string;

  /**
   * The number of matching files.
   *
   * @example 72600
   */
  totalCount: number;
};

/** One package's downloads over the last week. */
export type NpmDownloads = {
  /**
   * The number of downloads.
   *
   * @example 61234567
   */
  downloads: number;

  /**
   * The last day counted, as `YYYY-MM-DD`.
   *
   * @example "2026-10-18"
   */
  end: string;

  /**
   * The package's name.
   *
   * @example "fast-deep-equal"
   */
  package: string;

  /**
   * The first day counted, as `YYYY-MM-DD`.
   *
   * @example "2026-10-12"
   */
  start: string;
};

/** A command-line flag's text, and the range it must fall in. */
export type PositiveIntegerInput = {
  /**
   * The value when the flag is absent.
   *
   * @example 3
   */
  fallback: number | undefined;

  /**
   * The largest value allowed.
   *
   * @example 10
   */
  max: number;

  /**
   * The flag's text, if it was given.
   *
   * @example "5"
   */
  text: string | undefined;
};

/** One row of a report, keyed by its column names. */
export type ReportRow = Readonly<Record<string, number | string>>;

/** One argument value and how many calls passed it. */
export type TallyRow = {
  /**
   * The number of calls.
   *
   * @example 412
   */
  count: number;

  /**
   * The argument as written, or one of the `*_LABEL` placeholders.
   *
   * @example "10"
   */
  label: string;
};

/** One of `pnpm research:usage`'s modes. */
export type UsageMode = (typeof USAGE_MODES)[keyof typeof USAGE_MODES];

/** A finished report: the table, how it was measured, and its caveats. */
export type UsageReport = {
  /**
   * What the numbers can't be trusted for.
   *
   * @example `["Matching ignores case."]`
   */
  caveats: readonly string[];

  /**
   * The date the numbers were collected, as `YYYY-MM-DD`.
   *
   * @example "2026-10-19"
   */
  collected: string;

  /**
   * The table's column names, in order.
   *
   * @example `["Name", "Files"]`
   */
  columns: readonly string[];

  /**
   * How the numbers were measured, precise enough to repeat.
   *
   * @example "GitHub code search, one exact-phrase query per name."
   */
  method: string;

  /**
   * The mode that made the report.
   *
   * @example "counts"
   */
  mode: UsageMode;

  /**
   * The table's rows.
   *
   * @example `[{ Files: 72600, Name: "safeJsonParse" }]`
   */
  rows: readonly ReportRow[];

  /**
   * The report's heading.
   *
   * @example "Code search file counts"
   */
  title: string;
};

/** The fields every report builder takes. */
type CollectedInput = Pick<UsageReport, "collected">;

/** Every name's count, and when they were collected. */
type CountReportInput = {
  /**
   * Every name's count, in each language searched.
   *
   * @example `[{ isIncomplete: false, language: undefined, name: "safeJsonParse", totalCount: 72600 }]`
   */
  counts: readonly NameCount[];
} & CollectedInput;

/** Every package's downloads, and when they were collected. */
type DownloadReportInput = {
  /**
   * Each package npm knows, with its downloads.
   *
   * @example `[{ downloads: 61234567, end: "2026-10-18", package: "dequal", start: "2026-10-12" }]`
   */
  downloads: readonly NpmDownloads[];

  /**
   * Every package asked about, in order, including any npm doesn't know.
   *
   * @example `["dequal", "fast-deep-equal"]`
   */
  packages: readonly string[];
} & CollectedInput;

/** A code search's query and what it found. */
type FileReportInput = {
  /**
   * The query, qualifiers included.
   *
   * @example "formatInstructionFooter repo:bombshell-dev/clack"
   */
  query: string;
} & CodeSearchPage &
  CollectedInput;

/**
 * Build the report of how often one argument of a call takes each value.
 *
 * - Files that appear in more than one page are counted once.
 *
 * - A language can run out of results before `pages` pages, so the method
 *   says "up to" and then the real number of files sampled.
 *
 * @returns the report, rows sorted by count, most common first.
 */
export function buildCallReport(input: CallReportInput): UsageReport {
  const {
    argumentPosition,
    callee,
    collected,
    isIncomplete,
    items,
    languages,
    pages,
    totalCount,
  } = input;

  const files = uniqueItems(items);
  const tally = tallyCalls({ argumentPosition, callee, items: files });
  const callCount = tally.reduce((sum, { count }) => sum + count, 0);

  return {
    caveats: toCaveats({ isIncomplete, mode: USAGE_MODES.calls }),
    collected,
    columns: ["Argument", "Calls", "Share (%)"],
    method: `GitHub code search for \`${callee}\` in ${LIST_FORMAT.format(languages)}, up to the top ${formatCount(pages * 100)} files per language: ${formatCount(files.length)} files sampled of ${formatCount(totalCount)} matching, holding ${formatCount(callCount)} calls.`,
    mode: USAGE_MODES.calls,
    rows: tally.map(({ count, label }) => ({
      Argument: label,
      Calls: count,
      "Share (%)": Number(((count / callCount) * 100).toFixed(1)),
    })),
    title: `\`${callee}\` argument ${argumentPosition}`,
  };
}

/**
 * Build the report of how many files hold each exact name.
 *
 * - With languages, each gets a column, plus a `Total` of them when there are
 *   several; without, one `Files` column counts every language.
 *
 * @returns the report, names in the order given.
 */
export function buildCountReport({
  collected,
  counts,
}: CountReportInput): UsageReport {
  const languageColumns = [
    ...new Set(counts.map(({ language }) => toLanguageColumn(language))),
  ];

  const names = [...new Set(counts.map(({ name }) => name))];

  // A file has one language, so summing the language columns counts none twice.
  const hasTotal = languageColumns.length > 1;

  const rows = names.map((name) => {
    const nameCounts = counts.filter((count) => count.name === name);

    const cellsByColumn = nameCounts.reduce<Record<string, number | string>>(
      (cellsByLanguage, { language, totalCount }) => {
        cellsByLanguage[toLanguageColumn(language)] = totalCount;

        return cellsByLanguage;
      },
      { Name: name }
    );

    if (hasTotal) {
      cellsByColumn.Total = languageColumns.reduce(
        (sum, column) => sum + Number(cellsByColumn[column]),
        0
      );
    }

    return cellsByColumn;
  });

  const isIncomplete = counts.some((count) => count.isIncomplete);

  return {
    caveats: toCaveats({ isIncomplete, mode: USAGE_MODES.counts }),
    collected,
    columns: ["Name", ...languageColumns, ...(hasTotal ? ["Total"] : [])],
    method:
      'GitHub code search, one exact-phrase query (`"<name>"`) per name, reading its `total_count`.',
    mode: USAGE_MODES.counts,
    rows,
    title: "Code search file counts",
  };
}

/** Build the report of an npm package's weekly downloads. @returns it. */
export function buildDownloadReport({
  collected,
  downloads,
  packages,
}: DownloadReportInput): UsageReport {
  const week = downloads[0];

  return {
    caveats: CAVEATS_BY_MODE.npm,
    collected,
    columns: ["Package", "Weekly downloads"],
    method:
      week === undefined
        ? "npm's downloads API, last week."
        : `npm's downloads API, ${week.start} to ${week.end}.`,
    mode: USAGE_MODES.npm,
    rows: packages.map((name) => ({
      Package: name,
      "Weekly downloads":
        downloads.find((entry) => entry.package === name)?.downloads ??
        "not found",
    })),
    title: "npm weekly downloads",
  };
}

/** Build the report listing the files a code search found. @returns it. */
export function buildFileReport({
  collected,
  isIncomplete,
  items,
  query,
  totalCount,
}: FileReportInput): UsageReport {
  return {
    caveats: toCaveats({ isIncomplete, mode: USAGE_MODES.files }),
    collected,
    columns: ["Repository", "Path", "URL"],
    method: `GitHub code search for \`${query}\`: the top ${formatCount(items.length)} of ${formatCount(totalCount)} matching files.`,
    mode: USAGE_MODES.files,
    rows: items.map(({ path, repository, url }) => ({
      Path: path,
      Repository: repository,
      URL: url,
    })),
    title: "Code search results",
  };
}

/** Whether an error message from `gh` reports a rate limit. @returns it. */
export function isRateLimited(message: string): boolean {
  return RATE_LIMIT_PATTERN.test(message);
}

/** Whether a string names one of the modes. @returns it. */
export function isUsageMode(value: string | undefined): value is UsageMode {
  return value !== undefined && USAGE_MODE_NAMES.has(value);
}

/**
 * Read a positive whole number from a command-line flag.
 *
 * @returns the number, `fallback` when the flag is absent, or `undefined` when
 *   its text isn't a positive whole number up to `max`.
 */
export function parsePositiveInteger({
  fallback,
  max,
  text,
}: PositiveIntegerInput): number | undefined {
  if (text === undefined) {
    return fallback;
  }

  const value = Number(text);

  return /^\d+$/u.test(text) && value >= 1 && value <= max ? value : undefined;
}

/**
 * Render a report as Markdown: its heading, the table, then how it was
 * measured and what it can't be trusted for.
 *
 * - A column holding any number is right-aligned, and numbers get thousands
 *   separators.
 *
 * @returns the Markdown text, ending in a newline.
 */
export function renderReportMarkdown(report: UsageReport): string {
  const isNumericByColumn = report.columns.map((column) =>
    report.rows.some((row) => typeof row[column] === "number")
  );

  const lines = [
    `## ${report.title}`,
    "",
    `| ${report.columns.map((column) => escapeTableCell(column)).join(" | ")} |`,
    `| ${isNumericByColumn.map((isNumeric) => (isNumeric ? "---:" : ":---")).join(" | ")} |`,
    ...report.rows.map(
      (row) =>
        `| ${report.columns.map((column) => renderCell(row[column])).join(" | ")} |`
    ),
    "",
    `- **Method**: ${report.method}`,
    `- **Collected**: ${report.collected}`,
    "- **Caveats**:",
    ...report.caveats.map((caveat) => `  - ${caveat}`),
  ];

  return `${lines.join("\n")}\n`;
}

/**
 * Tally the values one argument takes across the calls in some files.
 *
 * @returns one row per value, most common first, ties by label.
 */
export function tallyCalls({
  argumentPosition,
  callee,
  items,
}: Pick<CallReportInput, "argumentPosition" | "callee" | "items">): TallyRow[] {
  const countsByLabel = items
    .flatMap(({ fragments }) => fragments)
    .flatMap((fragment) => splitCalls({ callee, fragment }))
    .map((callArguments) =>
      callArguments === undefined
        ? CUT_OFF_LABEL
        : classifyArgument(callArguments[argumentPosition - 1])
    )
    .reduce<Map<string, number>>((countsByValue, label) => {
      countsByValue.set(label, (countsByValue.get(label) ?? 0) + 1);

      return countsByValue;
    }, new Map());

  return (
    [...countsByLabel]
      .map(([label, count]) => ({ count, label }))
      // Labels are unique, and code-unit order is the same on every machine.
      .sort(
        (left, right) =>
          right.count - left.count || (left.label < right.label ? -1 : 1)
      )
  );
}

/**
 * Narrow one page of `GET /search/code`.
 *
 * @returns the page.
 * @throws Error when the response isn't shaped like a code search page.
 */
export function toCodeSearchPage(value: unknown): CodeSearchPage {
  if (
    !isRecord(value) ||
    typeof value.total_count !== "number" ||
    !Array.isArray(value.items)
  ) {
    throw new Error("the code search response has no total_count or items");
  }

  const items: unknown[] = value.items;

  return {
    isIncomplete: value.incomplete_results === true,
    items: items.map((item) => toCodeSearchItem(item)),
    totalCount: value.total_count,
  };
}

/**
 * Write a `language:` qualifier, quoting a name with a space in it.
 *
 * @returns the qualifier.
 */
export function toLanguageQualifier(language: string): string {
  return hasWhitespace(language)
    ? `language:"${language}"`
    : `language:${language}`;
}

/**
 * Narrow a response of npm's `downloads/point/last-week/<package>`.
 *
 * @returns the downloads, or `undefined` for a package npm doesn't know.
 * @throws Error when the response is neither downloads nor an error.
 */
export function toNpmDownloads(value: unknown): NpmDownloads | undefined {
  if (isRecord(value) && typeof value.error === "string") {
    return undefined;
  }

  if (
    !isRecord(value) ||
    typeof value.downloads !== "number" ||
    typeof value.end !== "string" ||
    typeof value.package !== "string" ||
    typeof value.start !== "string"
  ) {
    throw new Error("the npm downloads response has no downloads");
  }

  return {
    downloads: value.downloads,
    end: value.end,
    package: value.package,
    start: value.start,
  };
}

/**
 * Build the URL of npm's last-week downloads for a package, encoding each
 * part of a scoped name.
 *
 * @returns the URL.
 */
export function toNpmDownloadsUrl(name: string): string {
  const path = name
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `https://api.npmjs.org/downloads/point/last-week/${path}`;
}

/**
 * Drop repeated values, ignoring case, keeping each one's first spelling.
 *
 * @returns the values left, in order.
 */
export function uniqueIgnoringCase(values: readonly string[]): string[] {
  return values.filter(
    (value, index) =>
      values.findIndex(
        (other) => other.toLowerCase() === value.toLowerCase()
      ) === index
  );
}

/** Label an argument as written when it's a literal. @returns the label. */
function classifyArgument(argument: string | undefined): string {
  if (argument === undefined) {
    return NO_ARGUMENT_LABEL;
  }

  return LITERAL_PATTERN.test(argument) ? argument : EXPRESSION_LABEL;
}

/** Format a count with thousands separators. @returns the text. */
function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

/** Render one cell: a number with separators, a gap as `—`. @returns it. */
function renderCell(value: number | string | undefined): string {
  if (value === undefined) {
    return "—";
  }

  return typeof value === "number"
    ? formatCount(value)
    : escapeTableCell(value);
}

/** A mode's caveats, plus the timeout one when it applies. @returns them. */
function toCaveats({
  isIncomplete,
  mode,
}: Pick<CodeSearchPage, "isIncomplete"> &
  Pick<UsageReport, "mode">): readonly string[] {
  return isIncomplete
    ? [...CAVEATS_BY_MODE[mode], TIMEOUT_CAVEAT]
    : CAVEATS_BY_MODE[mode];
}

/**
 * Narrow one file of a code search page.
 *
 * @returns the file.
 * @throws Error when it has no path, page, or repository.
 */
function toCodeSearchItem(item: unknown): CodeSearchItem {
  if (
    !isRecord(item) ||
    typeof item.path !== "string" ||
    typeof item.html_url !== "string" ||
    !isRecord(item.repository) ||
    typeof item.repository.full_name !== "string"
  ) {
    throw new Error("a code search result has no path, URL, or repository");
  }

  const textMatches: unknown[] = Array.isArray(item.text_matches)
    ? item.text_matches
    : [];

  return {
    fragments: textMatches.flatMap((textMatch) =>
      isRecord(textMatch) &&
      textMatch.property === "content" &&
      typeof textMatch.fragment === "string"
        ? [textMatch.fragment]
        : []
    ),
    path: item.path,
    repository: item.repository.full_name,
    url: item.html_url,
  };
}

/**
 * Name a language's count column: `Files` for every language, and a
 * `language:` prefix on a name that would clash with a fixed column.
 *
 * @returns the column name.
 */
function toLanguageColumn(language: string | undefined): string {
  if (language === undefined) {
    return "Files";
  }

  return RESERVED_COLUMNS.has(language.toLowerCase())
    ? `language:${language}`
    : language;
}

/** Drop repeated files, keeping one of each URL. @returns the rest. */
function uniqueItems(items: readonly CodeSearchItem[]): CodeSearchItem[] {
  return [...new Map(items.map((item) => [item.url, item])).values()];
}
