/*
 * Pure helpers that read and edit the frontmatter of an OKF record.
 *
 * - Edits are targeted line replacements, never a YAML round-trip, so nothing
 *   else in the file is reformatted.
 *
 * - Nothing here touches the file system or the clock; the caller passes the
 *   timestamp in.
 */

/**
 * Where a record stands with the human sign-off.
 *
 * - `unverified` has no sign-off from the verifier yet.
 *
 * - `changed` was regenerated after the sign-off, so it needs a fresh one.
 *
 * - `verified` was signed off and left alone since.
 */
export type RecordState = "changed" | "unverified" | "verified";

/**
 * The frontmatter fields the verify flow shows and decides on.
 */
export type RecordSummary = {
  /** When the record was last generated, if it says. */
  generatedAt: string | undefined;

  /** The record's `status`; OKF treats an absent one as `stable`. */
  status: string | undefined;

  /** The record's `title`, without its quotes. */
  title: string | undefined;

  /** The record's `type`, e.g. `Decision`. */
  type: string | undefined;

  /** When `verifiedBy` last signed the record off, if they did. */
  verifiedAt: string | undefined;
};

/**
 * The outcome of verifying one record: its new text, or why it was refused.
 */
export type RecordVerification =
  | {
      /** Whether the record was verified; `false` here. */
      isOk: false;

      /** Why the record can't be verified. */
      reason: string;
    }
  | {
      /** Whether the record was verified; `true` here. */
      isOk: true;

      /** The record's new text. */
      text: string;
    };

/**
 * A record's text split around its frontmatter.
 */
type FrontmatterBlock = {
  /** The line break the file uses, kept for every line written back. */
  lineBreak: string;

  /** Frontmatter lines, without the `---` fences. */
  lines: string[];

  /** Everything after the opening fence, including the closing one. */
  rest: string[];
};

/**
 * A run of consecutive lines, both ends inclusive.
 */
type LineRange = {
  /** Index of the run's last line. */
  endIndex: number;

  /** Index of the run's first line. */
  startIndex: number;
};

/** The line that opens and closes a frontmatter block. */
const fence = "---";

/** What a timestamp looks like on a line: up to the next separator. */
const timestamp = String.raw`[^\s,}\]]+`;

/** A line that continues the key above it: indented text. */
const indentedLine = /^\s+\S/;

/** A line that continues `verified`: a list item, or indented text. */
const verifiedContinuation = /^(?:\s*-\s|\s+\S)/;

/** A line that starts a list item. */
const listItemLine = /^\s*-\s/;

/**
 * Judge whether a record still needs a human sign-off.
 *
 * - `changed` means it was generated after `verifiedBy` last signed it off, or
 *   that the sign-off's timestamp can't be read.
 *
 * - `verified` means it was signed off and not touched since.
 */
export function getRecordState(summary: RecordSummary): RecordState {
  if (summary.verifiedAt === undefined) {
    return "unverified";
  }

  if (summary.generatedAt === undefined) {
    return "verified";
  }

  const verifiedTime = Date.parse(summary.verifiedAt);
  const generatedTime = Date.parse(summary.generatedAt);

  // Written so an unreadable timestamp (`NaN`) reads as "changed".
  return generatedTime <= verifiedTime ? "verified" : "changed";
}

/**
 * Read the fields the verify flow shows and decides on.
 *
 * @returns the summary, or `undefined` when the text has no frontmatter block.
 */
export function readRecordSummary(
  text: string,
  options: {
    /** Whose `verified` entry counts, e.g. `human:jjloneman`. */
    verifiedBy: string;
  }
): RecordSummary | undefined {
  const block = splitFrontmatter(text);

  if (block === undefined) {
    return undefined;
  }

  const { lines } = block;

  return {
    generatedAt: readGeneratedAt(lines),
    status: readScalar(lines, "status"),
    title: readScalar(lines, "title"),
    type: readScalar(lines, "type"),
    verifiedAt: findOwnEntry(lines, options.verifiedBy)?.at,
  };
}

/**
 * Mark a record verified: `draft` becomes `stable`, and `verifiedBy`'s entry
 * gets `at` as its timestamp.
 *
 * - An existing entry for `verifiedBy` has its `at` updated, in the inline,
 *   list, block-style, or flow-sequence form, rather than gaining a second
 *   entry.
 *
 * - A new entry lands after the `generated` field, or after `status` when there
 *   is no `generated`; `generated` may be inline or a nested block.
 *
 * - A `status` other than `draft` is left alone, and an absent one counts as
 *   `stable`, as OKF defines it, so only the `verified` entry is added.
 */
export function verifyRecord(
  text: string,
  options: {
    /** The UTC timestamp to record, e.g. `2026-10-02T13:30:00Z`. */
    at: string;

    /** Who is signing off, e.g. `human:jjloneman`. */
    verifiedBy: string;
  }
): RecordVerification {
  const block = splitFrontmatter(text);

  if (block === undefined) {
    return { isOk: false, reason: "no frontmatter block" };
  }

  const lines = [...block.lines];
  const statusIndex = findKeyIndex(lines, "status");

  if (
    /^status:\s*(?<quote>["']?)draft\k<quote>\s*(?:#.*)?$/.test(
      lines[statusIndex] ?? ""
    )
  ) {
    lines[statusIndex] = "status: stable";
  }

  const layoutProblem = upsertVerified(lines, options);

  if (layoutProblem !== undefined) {
    return { isOk: false, reason: layoutProblem };
  }

  return {
    isOk: true,
    text: [fence, ...lines, ...block.rest].join(block.lineBreak),
  };
}

/**
 * Add an entry to the end of a flow sequence such as `[{ … }]`.
 */
function appendToFlowSequence(sequence: string, entry: string): string {
  const items = sequence.replace(/^\[\s*/, "").replace(/\s*\]$/, "");

  return items === "" ? `[${entry}]` : `[${items}, ${entry}]`;
}

/**
 * Escape the characters that are special in a regular expression.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
}

/**
 * Split the `verified` field into entries: the inline value on the key line,
 * then each list item with the indented lines that continue it.
 */
function findEntryItems(
  lines: readonly string[],
  range: LineRange
): LineRange[] {
  const items: LineRange[] = [];

  if (lines[range.startIndex]?.slice("verified:".length).trim() !== "") {
    items.push({ endIndex: range.startIndex, startIndex: range.startIndex });
  }

  for (let index = range.startIndex + 1; index <= range.endIndex; index += 1) {
    const lastItem = items.at(-1);

    if (listItemLine.test(lines[index] ?? "") || lastItem === undefined) {
      items.push({ endIndex: index, startIndex: index });
    } else {
      lastItem.endIndex = index;
    }
  }

  return items;
}

/**
 * Find the top-level line that starts with `key:`.
 *
 * @returns its index, or `-1` when there is none.
 */
function findKeyIndex(lines: readonly string[], key: string): number {
  return lines.findIndex((line) => line.startsWith(`${key}:`));
}

/**
 * Find the top-level line that starts with `key:`.
 */
function findKeyLine(
  lines: readonly string[],
  key: string
): string | undefined {
  return lines[findKeyIndex(lines, key)];
}

/**
 * Locate a key and the lines that continue it, if the key is present.
 *
 * - `isContinuation` decides which following lines belong to the key.
 */
function findKeyRange(
  lines: readonly string[],
  key: string,
  isContinuation: RegExp
): LineRange | undefined {
  const startIndex = findKeyIndex(lines, key);

  if (startIndex === -1) {
    return undefined;
  }

  let endIndex = startIndex;

  while (isContinuation.test(lines[endIndex + 1] ?? "")) {
    endIndex += 1;
  }

  return { endIndex, startIndex };
}

/**
 * Find the line holding `verifiedBy`'s `verified` entry, in any of the forms.
 *
 * - `index` is the line that carries the timestamp, which for a block-style
 *   list item is its `at:` line rather than the `- by:` line.
 */
function findOwnEntry(
  lines: readonly string[],
  verifiedBy: string
): { at: string | undefined; index: number; isBlock: boolean } | undefined {
  const range = findVerifiedRange(lines);

  if (range === undefined) {
    return undefined;
  }

  const inlineEntry = new RegExp(
    `${ownEntryPrefix(verifiedBy)}(?<at>${timestamp})`
  );
  const blockActor = new RegExp(
    `^\\s*(?:-\\s+)?by:\\s*${escapeRegExp(verifiedBy)}\\s*$`
  );
  const blockAt = new RegExp(`^\\s*(?:-\\s+)?at:\\s*(?<at>${timestamp})\\s*$`);

  for (const item of findEntryItems(lines, range)) {
    const itemLines = lines.slice(item.startIndex, item.endIndex + 1);

    if (itemLines.length === 1) {
      const at = inlineEntry.exec(itemLines[0] ?? "")?.groups?.at;

      if (at !== undefined) {
        return { at, index: item.startIndex, isBlock: false };
      }
    } else if (itemLines.some((line) => blockActor.test(line))) {
      const offset = itemLines.findIndex((line) => blockAt.test(line));

      // An entry by the owner with no timestamp to renew isn't one to keep.
      if (offset === -1) {
        continue;
      }

      return {
        at: blockAt.exec(itemLines[offset] ?? "")?.groups?.at,
        index: item.startIndex + offset,
        isBlock: true,
      };
    }
  }

  return undefined;
}

/**
 * Locate the `verified` key and every line that continues it.
 */
function findVerifiedRange(lines: readonly string[]): LineRange | undefined {
  return findKeyRange(lines, "verified", verifiedContinuation);
}

/**
 * Match `by: <verifiedBy>, at: ` exactly, so `human:jjloneman2` is no one's
 * alias; a lookbehind on it picks out just the timestamp.
 */
function ownEntryPrefix(verifiedBy: string): string {
  return String.raw`\bby:\s*${escapeRegExp(verifiedBy)}\s*,\s*at:\s*`;
}

/**
 * Read `generated.at`, whether `generated` is inline or a nested block.
 */
function readGeneratedAt(lines: readonly string[]): string | undefined {
  const range = findKeyRange(lines, "generated", indentedLine);

  return range === undefined
    ? undefined
    : new RegExp(`\\bat:\\s*(?<at>${timestamp})`).exec(
        lines.slice(range.startIndex, range.endIndex + 1).join(" ")
      )?.groups?.at;
}

/**
 * Read a one-line scalar value, without its surrounding quotes.
 */
function readScalar(lines: readonly string[], key: string): string | undefined {
  const value = findKeyLine(lines, key)
    ?.slice(key.length + 1)
    .trim();

  return value?.replace(/^(?<quote>["'])(?<inner>.*)\k<quote>$/, "$<inner>");
}

/**
 * Split a record around its frontmatter, remembering its line breaks.
 *
 * @returns the parts, or `undefined` when there is no closed `---` block.
 */
function splitFrontmatter(text: string): FrontmatterBlock | undefined {
  const lineBreak = text.includes("\r\n") ? "\r\n" : "\n";
  const [first, ...remaining] = text.split(lineBreak);

  if (first !== fence) {
    return undefined;
  }

  const closingIndex = remaining.indexOf(fence);

  if (closingIndex === -1) {
    return undefined;
  }

  return {
    lineBreak,
    lines: remaining.slice(0, closingIndex),
    rest: remaining.slice(closingIndex),
  };
}

/**
 * Add or renew `verifiedBy`'s entry in place.
 *
 * @returns why the `verified` field can't be edited safely, or `undefined`.
 */
function upsertVerified(
  lines: string[],
  options: { at: string; verifiedBy: string }
): string | undefined {
  const { at, verifiedBy } = options;
  const entry = `{ by: ${verifiedBy}, at: ${at} }`;
  const range = findVerifiedRange(lines);

  if (range === undefined) {
    const anchor =
      findKeyRange(lines, "generated", indentedLine) ??
      findKeyRange(lines, "status", indentedLine);
    lines.splice(
      anchor === undefined ? lines.length : anchor.endIndex + 1,
      0,
      `verified: ${entry}`
    );

    return undefined;
  }

  const own = findOwnEntry(lines, verifiedBy);

  if (own !== undefined) {
    const timestampPattern = own.isBlock
      ? new RegExp(`(?<=\\bat:\\s*)${timestamp}`)
      : new RegExp(`(?<=${ownEntryPrefix(verifiedBy)})${timestamp}`);
    lines[own.index] = (lines[own.index] ?? "").replace(timestampPattern, at);

    return undefined;
  }

  const inlineValue = (lines[range.startIndex] ?? "")
    .slice("verified:".length)
    .trim();
  const hasListItem = lines
    .slice(range.startIndex + 1, range.endIndex + 1)
    .some((line) => listItemLine.test(line));

  if (/^(?:null|~)$/.test(inlineValue)) {
    lines[range.startIndex] = `verified: ${entry}`;

    return undefined;
  }

  if (inlineValue === "" && range.endIndex > range.startIndex && !hasListItem) {
    return "`verified` is a nested mapping, not a list";
  }

  if (inlineValue === "") {
    lines.splice(range.endIndex + 1, 0, `  - ${entry}`);
  } else if (inlineValue.startsWith("[")) {
    lines[range.startIndex] =
      `verified: ${appendToFlowSequence(inlineValue, entry)}`;
  } else {
    // Someone else signed off in the inline form; keep theirs as a list item.
    lines.splice(
      range.startIndex,
      1,
      "verified:",
      `  - ${inlineValue}`,
      `  - ${entry}`
    );
  }

  return undefined;
}
