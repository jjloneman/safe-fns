import { fileURLToPath } from "node:url";

import type { Tier } from "../../../scripts/research/results.ts";

import { readJsonFile } from "../../../scripts/research/json.ts";

/** One expression a tool offers for a function. */
export type Probe = {
  /**
   * Whether the call can take these arguments at all; `n/a` otherwise.
   *
   * @example `([value]) => typeof value === "string"`
   */
  accepts?: (args: readonly unknown[]) => boolean;

  /**
   * The expression, as the table header shows it.
   *
   * @example "yn(value)"
   */
  call: string;

  /**
   * Runs the expression on one case's decoded arguments.
   *
   * @example `([value]) => yn(value)`
   */
  run: (args: readonly unknown[]) => unknown;
};

/** A library or runtime, and its probes for each function. */
export type Tool = {
  /**
   * Probes keyed by the function name in a case file.
   *
   * @example `{ safeParseBoolean: [{ call: "yn(value)", run }] }`
   */
  functions: Record<string, readonly Probe[]>;

  /**
   * The display name.
   *
   * @example "zod"
   */
  name: string;

  /**
   * The table tier.
   *
   * @example 1
   */
  tier: Tier;

  /**
   * The version, read from the installed package.
   *
   * @example "4.6.5"
   */
  version: string;
};

/** Accept only a string first argument; other cases are `n/a`. */
export const isString = ([value]: readonly unknown[]): boolean =>
  typeof value === "string";

/**
 * Name a thrown value's class, without trusting it to be inspectable.
 *
 * - Plain JavaScript once its types are stripped, so the Hermes adapter embeds
 *   its source too; keep it free of imports and module-level names.
 */
export function errorName(error: unknown): string {
  try {
    if (!(error instanceof Error)) {
      return typeof error;
    }

    /*
     * Prefer the class's own name when `name` is the one every subclass
     * inherits, so `TomlError` isn't reported as `Error`.
     *
     * - Otherwise prefer `name`: some libraries throw instances of anonymous
     *   classes, whose constructor name is empty.
     */
    const className = error.constructor.name;

    if (error.name === "Error" && className !== "") {
      return className;
    }

    return error.name || className;
  } catch {
    return "an uninspectable error";
  }
}

/** Read an installed library's version. */
export function packageVersion(name: string): string {
  // Read from disk: some packages leave `package.json` out of `exports`.
  const manifest = readJsonFile(
    fileURLToPath(
      new URL(`../../node_modules/${name}/package.json`, import.meta.url)
    )
  );

  return typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
    ? manifest.version
    : "unknown";
}
