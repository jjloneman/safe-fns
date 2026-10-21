import { fileURLToPath } from "node:url";

import type { CaseEntry, Tier } from "../../../scripts/research/results.ts";

import { decodeValue } from "../../../scripts/research/codec.ts";
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

/** What `markReferences` writes for a reference back to an ancestor. */
const CYCLE = Symbol("cycle");

/** What `markReferences` writes for an object it already copied elsewhere. */
const REPEAT = Symbol("repeat");

/** What `summarizeError` reports for a `message` whose getter throws. */
/**
 * What a `$js` case decodes to in an engine driven from Node (Hermes,
 * AssemblyScript): only the Node adapter's factories can build the value, so
 * that engine reports the case `n/a`.
 */
export const UNBUILDABLE: unique symbol = Symbol("unbuildable");

const UNREADABLE_MESSAGE = Symbol("unreadable message");

/** What an error helper returned for one input, as its cell shows it. */
type ErrorSummary = {
  /**
   * The resulting error's `message`.
   *
   * @example "boom"
   */
  message: unknown;

  /**
   * Whether the call returned its input itself, rather than a new error.
   *
   * @example true
   */
  unchanged: boolean;
};

/** An error helper's result, and the input it was given. */
type ErrorSummaryInput = {
  /**
   * The helper's result.
   *
   * @example `new Error("boom")`
   */
  error: Error;

  /**
   * What the helper was given.
   *
   * @example "boom"
   */
  input: unknown;
};

/** An object, the path that reached it, and every object copied so far. */
type ReferenceWalk = {
  /**
   * The objects on the path from the root to `value`.
   *
   * @example `[root]`
   */
  ancestors: readonly object[];

  /**
   * Every array and plain object already copied, anywhere in the result.
   *
   * @example `new Set([root])`
   */
  seen: Set<object>;

  /**
   * The value to copy.
   *
   * @example `{ self: root }`
   */
  value: unknown;
};

/**
 * JSON's `JSON.parse`, typed `unknown`.
 *
 * - Called bare on purpose: it's the function under test, so its throw is the
 *   outcome to record, not an error to wrap.
 */
export function callJsonParse(text: string): unknown {
  // eslint-disable-next-line no-restricted-properties -- the function under test
  return JSON.parse(text);
}

/**
 * Decode a case's arguments with the shared codec, for an engine that can't
 * run the Node adapter's factories.
 *
 * @returns the decoded arguments, with each `$js` value as `UNBUILDABLE`.
 */
export function decodeWithoutFactories(args: CaseEntry["args"]): unknown[] {
  return args.map((encoded) =>
    decodeValue({ encoded, resolveJs: () => UNBUILDABLE })
  );
}

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

/** Accept only a string first argument; other cases are `n/a`. */
export function isString([value]: readonly unknown[]): boolean {
  return typeof value === "string";
}

/**
 * Copy a result's arrays and plain objects, writing `Symbol(cycle)` where a
 * value refers back to one of its ancestors, and `Symbol(repeat)` where it
 * refers to an object already copied elsewhere.
 *
 * - The codec walks a result to encode it, so a cycle would never end, and
 *   two references to one object would print as two equal copies; marking
 *   them shows whether a clone kept the input's identities.
 *
 * - A null prototype is kept; anything else (a `Date`, a `Map`, a class
 *   instance) is kept as it is, for the codec to describe.
 *
 * - Like the codec, it reads only string keys: a symbol key never shows.
 *
 * @returns the copy, safe to encode.
 */
export function markReferences(value: unknown): unknown {
  return markReferencesWithin({ ancestors: [], seen: new Set(), value });
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

/**
 * Summarize what an error helper returned, for a `toError` column.
 *
 * @returns the error's message, and whether it is the input itself.
 */
export function summarizeError({
  error,
  input,
}: ErrorSummaryInput): ErrorSummary {
  return { message: readMessage(error), unchanged: error === input };
}

/** Copy one value for `markReferences`, given the path that reached it. */
function markReferencesWithin({
  ancestors,
  seen,
  value,
}: ReferenceWalk): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (ancestors.includes(value)) {
    return CYCLE;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  const isArray = Array.isArray(value);

  if (!isArray && prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  if (seen.has(value)) {
    return REPEAT;
  }

  seen.add(value);

  const path = [...ancestors, value];

  if (isArray) {
    return value.map((item: unknown) =>
      markReferencesWithin({ ancestors: path, seen, value: item })
    );
  }

  const entries = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      markReferencesWithin({ ancestors: path, seen, value: item }),
    ])
  );

  // `Object.assign` sets keys on a null-prototype target, where `__proto__`
  // is an ordinary key, so the copy keeps every entry.
  return prototype === null
    ? Object.assign(Object.create(null) as object, entries)
    : entries;
}

/** Read an error's `message`, marking one whose getter throws. */
function readMessage(error: Error): unknown {
  try {
    return error.message;
  } catch {
    return UNREADABLE_MESSAGE;
  }
}
