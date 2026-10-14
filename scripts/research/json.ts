/*
 * The one place the research harness parses JSON.
 *
 * - `JSON.parse` throws a bare `SyntaxError` that doesn't say where the text
 *   came from, so every parse goes through `parseJson`, which names its
 *   source; ESLint's `no-restricted-properties` points every other research
 *   file here.
 *
 * - Serializing needs no wrapper: the harness only stringifies encoded values
 *   and strings, which hold nothing `JSON.stringify` throws on (a bigint, a
 *   cycle, a throwing `toJSON`).
 */
import { readFileSync } from "node:fs";

/** JSON text, and where it came from. */
export type JsonSource = {
  /**
   * Names the text in an error message: a file path or a process.
   *
   * @example "research/cases/codec.json"
   */
  source: string;

  /**
   * The text to parse.
   *
   * @example `{ "cases": [], "function": "codec" }`
   */
  text: string;
};

/**
 * Parse JSON text.
 *
 * @returns the parsed value, for the caller to narrow.
 * @throws Error naming the source when the text isn't JSON, with the
 *   `SyntaxError` as its `cause`.
 */
export function parseJson({ source, text }: JsonSource): unknown {
  try {
    // eslint-disable-next-line no-restricted-properties -- the sanctioned call
    const parsed: unknown = JSON.parse(text);

    return parsed;
  } catch (error) {
    throw new Error(`${source} isn't valid JSON`, { cause: error });
  }
}

/**
 * Read and parse a JSON file.
 *
 * - A read failure isn't wrapped: Node's message already names the path.
 *
 * @returns the parsed value, for the caller to narrow.
 * @throws Error naming the file when it isn't JSON.
 */
export function readJsonFile(file: string): unknown {
  return parseJson({ source: file, text: readFileSync(file, "utf8") });
}
