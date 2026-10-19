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
