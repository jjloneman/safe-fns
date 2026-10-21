import type { Duration } from "luxon";

/*
 * The log and error helpers the research scripts share, so every one prints
 * prefixed lines and describes an error's causes the same way.
 */

/** A message to print, and how. */
export type PrefixedMessage = {
  /**
   * The message, which may span several lines.
   *
   * @example "searching `parseInt language:TypeScript`, page 1"
   */
  message: string;

  /**
   * The script's tag, put before every line.
   *
   * @example "[research]"
   */
  prefix: string;

  /**
   * Prints one line: `console.log` for stdout, `console.error` for stderr.
   *
   * @example console.error
   */
  print: (line: string) => void;
};

/** A command still running, for a progress line. */
export type StillRunning = {
  /**
   * How long it has run.
   *
   * @example `Duration.fromObject({ seconds: 90 })`
   */
  elapsed: Duration;

  /**
   * Everything it has written to stderr so far.
   *
   * @example "Unhandled exception. System.InvalidOperationException: …"
   */
  stderr: string;

  /**
   * What is running.
   *
   * @example "dotnet"
   */
  subject: string;
};

/** The longest stderr excerpt a progress line quotes. */
const STDERR_EXCERPT_LENGTH = 200;

/**
 * Describe an error and every `cause` behind it, one per line.
 *
 * - A failed `execFile` already names its command and stderr in its message,
 *   so nothing else needs reading.
 *
 * @returns the messages, outermost first.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  return error.cause === undefined
    ? error.message
    : `${error.message}\n  caused by: ${describeError(error.cause)}`;
}

/**
 * Describe a command that hasn't finished, with the last line it wrote to
 * stderr.
 *
 * - A process that crashed but never exited (a runtime writing a crash dump)
 *   has usually said so on stderr, so quoting it tells a crash from a slow run.
 *
 * @returns one progress line.
 */
export function describeStillRunning({
  elapsed,
  stderr,
  subject,
}: StillRunning): string {
  const summary = `${subject}: still running after ${elapsed.toFormat("m'm' ss's'")}`;
  const lastLine = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .at(-1);

  if (lastLine === undefined) {
    return summary;
  }

  const excerpt =
    lastLine.length > STDERR_EXCERPT_LENGTH
      ? `${lastLine.slice(0, STDERR_EXCERPT_LENGTH)}…`
      : lastLine;

  return `${summary}; last stderr: ${excerpt}`;
}

/** Print a message, prefixing every line. */
export function printPrefixed({
  message,
  prefix,
  print,
}: PrefixedMessage): void {
  for (const line of message.split("\n")) {
    print(`${prefix} ${line}`);
  }
}
