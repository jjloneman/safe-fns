import { DateTime, Duration } from "luxon";
/*
 * Measures how code in the wild names and calls things, `pnpm research:usage`.
 *
 * - `counts <name>…` prints how many files GitHub's code search finds for each
 *   exact name; `--language <name>` (repeatable) adds a column per language,
 *   and a total of them when there are several.
 *
 * - `calls <callee> --argument <n>` samples the files that call `callee` and
 *   tallies the values its `n`th argument takes, as the `parseInt` radix
 *   tally did; `--language` (default JavaScript and TypeScript) and `--pages`
 *   (100 files each, default 3, at most 10) set the sample.
 *
 * - `files <query>` lists the files a code search finds, qualifiers such as
 *   `repo:` included; `--limit` caps it (default 30, at most 100). The words
 *   are joined with spaces, so an exact phrase is quoted inside the query:
 *   `files '"safe parse" repo:o/r'`.
 *
 * - `npm <package>…` prints each package's downloads over the last week.
 *
 * - The report goes to stdout as JSON, for `jq`, or as Markdown with
 *   `--markdown`, stamped with its method, date, and caveats so a decision
 *   record can quote it; progress goes to stderr, so piping the report keeps
 *   it clean.
 *
 * - Authentication is `gh`'s: GitHub is called through `gh api`, never with a
 *   token of the script's own.
 */
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs, promisify } from "node:util";

import type { CodeSearchPage, NameCount, UsageReport } from "./usage-tally.ts";

import { parseJson } from "./json.ts";
import { describeError, printPrefixed } from "./logging.ts";
import {
  buildCallReport,
  buildCountReport,
  buildDownloadReport,
  buildFileReport,
  isRateLimited,
  isUsageMode,
  parsePositiveInteger,
  renderReportMarkdown,
  toCodeSearchPage,
  toLanguageQualifier,
  toNpmDownloads,
  toNpmDownloadsUrl,
  uniqueIgnoringCase,
  USAGE_MODES,
} from "./usage-tally.ts";

/** One code search request. */
type CodeSearchRequest = {
  /**
   * The 1-based page to read.
   *
   * @example 1
   */
  page: number;

  /**
   * How many files a page holds, at most 100.
   *
   * @example 100
   */
  perPage: number;

  /**
   * The query, qualifiers included.
   *
   * @example "parseInt language:TypeScript"
   */
  query: string;

  /**
   * Whether to ask for the text-match fragments around each hit.
   *
   * @example true
   */
  shouldMatchText: boolean;
};

/** The command line, once `parseArgs` has read it. */
type ParsedCommandLine = ReturnType<typeof parseCommandLine>;

/** The languages a call tally searches when none is given. */
const DEFAULT_CALL_LANGUAGES = ["JavaScript", "TypeScript"];

/** `execFile`, awaitable, so searches can wait between requests. */
const EXEC_FILE_ASYNC = promisify(execFile);

/**
 * The most output `gh api` may print, 64 MiB: `execFile`'s 1 MiB default can't
 * hold a page of 100 files with their repositories and text matches.
 */
const GH_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/** Every log line's prefix. */
const LOG_PREFIX = "[usage-search]";

/** How many times a rate-limited search is tried before giving up. */
const MAX_SEARCH_ATTEMPTS = 4;

/** Code search returns at most 1,000 results, ten pages of 100. */
const MAX_SEARCH_PAGES = 10;

/** The most files a code search returns in one page. */
const MAX_SEARCH_PER_PAGE = 100;

/** How long to wait after a rate limit: code search's window is a minute. */
const RATE_LIMIT_WAIT = Duration.fromObject({ minutes: 1 });

/** Code search allows 10 requests a minute, so space them a little wider. */
const SEARCH_INTERVAL = Duration.fromObject({ seconds: 6.5 });

/** What to print when the command line can't be read. */
const USAGE = `Usage:
  pnpm research:usage counts <name>… [--language <name>]…
  pnpm research:usage calls <callee> --argument <n> [--language <name>]… [--pages <n>]
  pnpm research:usage files <query> [--limit <n>]   (quote a phrase inside the query: '"safe parse" repo:o/r')
  pnpm research:usage npm <package>…
Add --markdown for a Markdown table instead of JSON.`;

/**
 * Make a code search function that waits between requests and retries a
 * rate-limited one.
 *
 * @returns the search function.
 */
function createCodeSearch(): (
  request: CodeSearchRequest
) => Promise<CodeSearchPage> {
  let nextSearchAt = DateTime.now();

  const search = async (
    request: CodeSearchRequest,
    attempt: number
  ): Promise<CodeSearchPage> => {
    await sleep(Math.max(0, nextSearchAt.diffNow().toMillis()));
    nextSearchAt = DateTime.now().plus(SEARCH_INTERVAL);
    log(`searching \`${request.query}\`, page ${request.page}`);

    try {
      const { stdout } = await EXEC_FILE_ASYNC("gh", toGhArguments(request), {
        maxBuffer: GH_MAX_BUFFER_BYTES,
      });

      return toCodeSearchPage(
        parseJson({
          source: `gh api search/code (${request.query})`,
          text: stdout,
        })
      );
    } catch (error) {
      if (!isRateLimited(readStderr(error)) || attempt >= MAX_SEARCH_ATTEMPTS) {
        throw error;
      }

      log(`rate-limited; retrying in ${RATE_LIMIT_WAIT.toHuman()}`);
      nextSearchAt = DateTime.now().plus(RATE_LIMIT_WAIT);

      return search(request, attempt + 1);
    }
  };

  return async (request) => search(request, 1);
}

/** Print a progress line to stderr, prefixing every line. */
function log(message: string): void {
  printPrefixed({ message, prefix: LOG_PREFIX, print: console.error });
}

/** Read the command line, allowing a mode and its words as positionals. */
function parseCommandLine() {
  return parseArgs({
    allowPositionals: true,
    options: {
      argument: { type: "string" },
      language: { multiple: true, type: "string" },
      limit: { type: "string" },
      markdown: { type: "boolean" },
      pages: { type: "string" },
    },
  });
}

/**
 * Read the `stderr` a failed `execFile` carries, which holds `gh`'s error
 * without the command line and its query.
 *
 * @returns it, or "" when there is none.
 */
function readStderr(error: unknown): string {
  return error instanceof Error &&
    "stderr" in error &&
    typeof error.stderr === "string"
    ? error.stderr
    : "";
}

/**
 * Run `calls`: sample the files calling a function and tally an argument.
 *
 * @returns the report, or `undefined` when the command line is incomplete.
 */
async function runCalls({
  positionals,
  values,
}: ParsedCommandLine): Promise<undefined | UsageReport> {
  // Exactly one callee: a stray word is more likely a typo than intended.
  const [callee] = positionals.length === 2 ? positionals.slice(1) : [];

  const argumentPosition = parsePositiveInteger({
    fallback: undefined,
    max: Number.MAX_SAFE_INTEGER,
    text: values.argument,
  });

  const pages = parsePositiveInteger({
    fallback: 3,
    max: MAX_SEARCH_PAGES,
    text: values.pages,
  });

  if (
    callee === undefined ||
    argumentPosition === undefined ||
    pages === undefined
  ) {
    return undefined;
  }

  const languages = uniqueIgnoringCase(
    values.language ?? DEFAULT_CALL_LANGUAGES
  );
  const search = createCodeSearch();
  const items = [];
  let isIncomplete = false;
  let totalCount = 0;

  // Sequential on purpose: code search's rate limit allows no parallelism.
  for (const language of languages) {
    for (let page = 1; page <= pages; page++) {
      const result = await search({
        page,
        perPage: MAX_SEARCH_PER_PAGE,
        query: `${callee} ${toLanguageQualifier(language)}`,
        shouldMatchText: true,
      });

      if (page === 1) {
        totalCount += result.totalCount;
      }

      isIncomplete ||= result.isIncomplete;
      items.push(...result.items);

      if (result.items.length < MAX_SEARCH_PER_PAGE) {
        break;
      }
    }
  }

  return buildCallReport({
    argumentPosition,
    callee,
    collected: today(),
    isIncomplete,
    items,
    languages,
    pages,
    totalCount,
  });
}

/**
 * Run `counts`: count the files holding each exact name.
 *
 * @returns the report, or `undefined` when no name was given.
 */
async function runCounts({
  positionals,
  values,
}: ParsedCommandLine): Promise<undefined | UsageReport> {
  const names = positionals.slice(1);

  if (names.length === 0) {
    return undefined;
  }

  const languages =
    values.language === undefined
      ? [undefined]
      : uniqueIgnoringCase(values.language);
  const search = createCodeSearch();
  const counts: NameCount[] = [];

  // Sequential on purpose: code search's rate limit allows no parallelism.
  for (const name of names) {
    for (const language of languages) {
      const { isIncomplete, totalCount } = await search({
        page: 1,
        perPage: 1,
        query:
          language === undefined
            ? `"${name}"`
            : `"${name}" ${toLanguageQualifier(language)}`,
        shouldMatchText: false,
      });

      counts.push({ isIncomplete, language, name, totalCount });
    }
  }

  return buildCountReport({ collected: today(), counts });
}

/**
 * Run `files`: list the files a code search finds.
 *
 * @returns the report, or `undefined` when the command line is incomplete.
 */
async function runFiles({
  positionals,
  values,
}: ParsedCommandLine): Promise<undefined | UsageReport> {
  const query = positionals.slice(1).join(" ");

  const limit = parsePositiveInteger({
    fallback: 30,
    max: MAX_SEARCH_PER_PAGE,
    text: values.limit,
  });

  if (query === "" || limit === undefined) {
    return undefined;
  }

  const result = await createCodeSearch()({
    page: 1,
    perPage: limit,
    query,
    shouldMatchText: false,
  });

  return buildFileReport({ collected: today(), query, ...result });
}

/**
 * Run `npm`: read each package's downloads over the last week.
 *
 * @returns the report, or `undefined` when no package was given.
 */
async function runNpm({
  positionals,
}: ParsedCommandLine): Promise<undefined | UsageReport> {
  const packages = positionals.slice(1);

  if (packages.length === 0) {
    return undefined;
  }

  const downloads = await Promise.all(
    packages.map(async (name) => {
      log(`reading ${name}'s downloads`);

      const response = await fetch(toNpmDownloadsUrl(name));

      // npm answers an unknown package with a 404 and an `error` body.
      if (!response.ok && response.status !== 404) {
        throw new Error(
          `npm downloads (${name}) answered HTTP ${response.status}`
        );
      }

      return toNpmDownloads(
        parseJson({
          source: `npm downloads (${name})`,
          text: await response.text(),
        })
      );
    })
  );

  return buildDownloadReport({
    collected: today(),
    downloads: downloads.filter((entry) => entry !== undefined),
    packages,
  });
}

/** Today's date in UTC, as `YYYY-MM-DD`. @returns it. */
function today(): string {
  return DateTime.utc().toISODate();
}

/** Turn a code search request into `gh api`'s arguments. @returns them. */
function toGhArguments({
  page,
  perPage,
  query,
  shouldMatchText,
}: CodeSearchRequest): string[] {
  return [
    "api",
    "--method",
    "GET",
    "search/code",
    "--raw-field",
    `q=${query}`,
    "--raw-field",
    `per_page=${perPage}`,
    "--raw-field",
    `page=${page}`,
    ...(shouldMatchText
      ? ["--header", "Accept: application/vnd.github.text-match+json"]
      : []),
  ];
}

/** Run the mode the command line names, and print its report. */
async function main(): Promise<void> {
  const commandLine = parseCommandLine();
  const [mode] = commandLine.positionals;

  if (!isUsageMode(mode)) {
    log(USAGE);
    process.exitCode = 1;

    return;
  }

  const runners = {
    [USAGE_MODES.calls]: runCalls,
    [USAGE_MODES.counts]: runCounts,
    [USAGE_MODES.files]: runFiles,
    [USAGE_MODES.npm]: runNpm,
  };

  const report = await runners[mode](commandLine);

  if (report === undefined) {
    log(USAGE);
    process.exitCode = 1;

    return;
  }

  // The report is the output, not a log line, so it carries no prefix.
  process.stdout.write(
    commandLine.values.markdown === true
      ? renderReportMarkdown(report)
      : `${JSON.stringify(report, undefined, 2)}\n`
  );
}

try {
  await main();
} catch (error) {
  log(describeError(error));
  process.exitCode = 1;
}
