import { fileURLToPath } from "node:url";

import type { CaseEntry, Tier } from "../../../scripts/research/results.ts";

import { decodeValue } from "../../../scripts/research/codec.ts";
import { readJsonFile } from "../../../scripts/research/json.ts";

/** The settings a `pluralize` case can carry as its third argument. */
export type PluralizeCaseOptions = {
  /**
   * Whether the count leads the result.
   *
   * @example true
   */
  includeCount?: boolean;

  /**
   * The caller's own plural form.
   *
   * @example "children"
   */
  plural?: string;
};

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

/**
 * The value-like built-ins a `markClone` cell spells out, each read by a call
 * that throws for any other object, so the read is the brand check.
 */
/* eslint-disable @typescript-eslint/unbound-method -- each method is applied
   to another object on purpose: its throw is the brand check. */
const BUILT_IN_READERS: readonly (readonly [
  string,
  (value: object) => unknown,
])[] = [
  ["ArrayBuffer", (value) => readBytes(value)],
  ["BigInt", (value) => Reflect.apply(BigInt.prototype.valueOf, value, [])],
  ["Boolean", (value) => Reflect.apply(Boolean.prototype.valueOf, value, [])],
  ["Date", (value) => Reflect.apply(Date.prototype.getTime, value, [])],
  ["Number", (value) => Reflect.apply(Number.prototype.valueOf, value, [])],
  // `source` is the getter that throws for a non-RegExp; `flags` doesn't.
  [
    "RegExp",
    (value) =>
      `/${Reflect.get(RegExp.prototype, "source", value)}/${Reflect.get(
        RegExp.prototype,
        "flags",
        value
      )}`,
  ],
  ["String", (value) => Reflect.apply(String.prototype.valueOf, value, [])],
  ["Symbol", (value) => Reflect.apply(Symbol.prototype.valueOf, value, [])],
];
/* eslint-enable @typescript-eslint/unbound-method */

/** What `markReferences` writes for a reference back to an ancestor. */
const CYCLE = Symbol("cycle");

/** An error's own keys `markClone` shows without a non-enumerable suffix. */
const ERROR_KEYS: ReadonlySet<PropertyKey> = new Set(["cause", "message"]);

/** What `markClone` writes for a property that is a getter, never run. */
const GETTER = Symbol("getter");

/** What `markClone` writes for an array's missing index. */
const HOLE = Symbol("hole");

/** The first length `Array(n)` rejects with `RangeError`: 2^32. */
const ARRAY_LENGTH_LIMIT = 2 ** 32;

/**
 * The most items a `range` probe may be asked to build.
 *
 * - `Array(n)` throws `RangeError` only past 2^32 - 1, so a tool that
 *   allocates up front fills a shorter array as surely as one that pushes;
 *   either way, a length near 2^29 crashes Node with an uncatchable
 *   out-of-memory error.
 */
const MAX_RANGE_LENGTH = 10_000;

/** What `markReferences` writes for an object it already copied elsewhere. */
const REPEAT = Symbol("repeat");

/** What `markClone` writes for an object the clone holds from its source. */
const SHARED = Symbol("shared");

/** What `markClone` writes for a part of a clone that threw when read. */
const THREW = Symbol("threw");

/** The prototype every typed array shares, whose tag getter names its kind. */
const TYPED_ARRAY_PROTOTYPE: object =
  Reflect.getPrototypeOf(Uint8Array.prototype) ?? Object.prototype;

/**
 * What a `$js` case decodes to in an engine driven from Node (Hermes,
 * AssemblyScript): only the Node adapter's factories can build the value, so
 * that engine reports the case `n/a`.
 */
export const UNBUILDABLE: unique symbol = Symbol("unbuildable");

/** What `summarizeError` reports for a `message` whose getter throws. */
const UNREADABLE_MESSAGE = Symbol("unreadable message");

/** A numeric `range` case's bounds and step. */
export type RangeSpan = {
  /**
   * Where the range ends.
   *
   * @example 10
   */
  end: number;

  /**
   * Where the range starts, `0` for a one-argument case.
   *
   * @example 0
   */
  start: number;

  /**
   * The step, `1` when the case gives none.
   *
   * @example 3
   */
  step: number;
};

/** A clone and the value it was made from, for `markClone`. */
type CloneComparison = {
  /**
   * What the cloner returned.
   *
   * @example `{ a: [1] }`
   */
  clone: unknown;

  /**
   * The value the cloner was given.
   *
   * @example `{ a: [1] }`
   */
  source: unknown;
};

/** One object a `markClone` cell spells out, and how to mark its parts. */
type CloneDescription = {
  /**
   * Whether the object is an array, or a plain object from this realm.
   *
   * @example true
   */
  isPlain: boolean;

  /**
   * The object's prototype, read once by the walk.
   *
   * @example `null`
   */
  prototype: unknown;

  /**
   * Every object reachable from the clone's source.
   *
   * @example `new Set([source])`
   */
  sourceObjects: ReadonlySet<object>;

  /**
   * The object.
   *
   * @example `new Map([["a", 1]])`
   */
  value: object;

  /**
   * Marks one part of the object, on the path through it.
   *
   * @example `(item) => markWithin({ …walk, value: item })`
   */
  visit: (item: unknown) => unknown;
};

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

/** An own key, and the object that holds it. */
type KeyRead = {
  /**
   * The key.
   *
   * @example "a"
   */
  key: ReturnType<typeof Reflect.ownKeys>[number];

  /**
   * The object.
   *
   * @example `{ a: 1 }`
   */
  value: object;
};

/** An object whose own keys a `markClone` cell lists, and how to list them. */
type OwnEntriesRead = {
  /**
   * Keys shown without a non-enumerable suffix, though they have one.
   *
   * @example `new Set(["message"])`
   */
  plainKeys?: ReadonlySet<PropertyKey>;

  /**
   * Keys left out.
   *
   * @example `new Set(["stack"])`
   */
  skippedKeys?: ReadonlySet<PropertyKey>;
} & Pick<CloneDescription, "value" | "visit">;

/** What `isBoundedRange` reads from a `range` case's check. */
type RangeBoundCheck = Pick<RangeCaseCheck, "args" | "shouldBoundEveryCount">;

/** A positional `range` function, and the case to call it with. */
type RangeCall = {
  /**
   * The case's arguments.
   *
   * @example `[0, 10, { step: 3 }]`
   */
  args: readonly unknown[];

  /**
   * The function, called as `call(start, end, step)`.
   *
   * @example `lodash.range`
   */
  call: (...args: never[]) => unknown;
};

/** A `range` case, and the forms a call can express. */
type RangeCaseCheck = {
  /**
   * The case's arguments.
   *
   * @example `[0, 10, { step: 3 }]`
   */
  args: readonly unknown[];

  /**
   * Whether the call has a one-argument `(end)` form.
   *
   * @example true
   */
  hasEndForm: boolean;

  /**
   * Whether the call takes the case's options object whole, so an unreadable
   * one is the call's own input rather than a read the probe fails.
   *
   * @example true
   */
  hasOptionsParameter: boolean;

  /**
   * The option keys the call can express.
   *
   * @example `["step"]`
   */
  optionKeys: readonly string[];

  /**
   * Whether every long count is `n/a`, even one past the array limit, for a
   * call that steps toward `end` with no length to fail on (`Iterator.range`
   * is lazy, and radash's `list` loops).
   *
   * @example true
   */
  shouldBoundEveryCount: boolean;
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
   * For `markClone`: every object reachable from the source, so one the
   * clone still holds is marked as shared; absent for `markReferences`.
   *
   * @example `new Set([source])`
   */
  sourceObjects?: ReadonlySet<object>;

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
 * Call a positional `range` function with a case's arguments, spread as
 * `rangeArguments` spreads them.
 *
 * @returns whatever the call returns.
 */
export function callWithRange({ args, call }: RangeCall): unknown {
  const result: unknown = Reflect.apply(call, undefined, rangeArguments(args));

  return result;
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

/** Accept a case with no options, for a call that has no way to take them. */
export function hasNoOptions(args: readonly unknown[]): boolean {
  return args.length === 1;
}

/**
 * Whether a case is one string and an options object holding exactly these
 * keys, so a probe runs only the cases its call can express.
 *
 * @returns whether the probe can run the case.
 */
export function hasOnlyOptions(
  args: readonly unknown[],
  keys: readonly string[]
): boolean {
  const [value, options] = args;

  return (
    args.length === 2 &&
    typeof value === "string" &&
    typeof options === "object" &&
    options !== null &&
    Object.keys(options).sort().join() === [...keys].sort().join()
  );
}

/**
 * Whether a `deepMerge` case is two values and `{ arrays: "concat" }`, for a
 * call that concatenates arrays.
 *
 * @returns whether the probe can run the case.
 */
export function isConcatPair(args: readonly unknown[]): boolean {
  const [, , options] = args;

  if (args.length !== 3 || typeof options !== "object" || options === null) {
    return false;
  }

  try {
    return (
      Object.keys(options).join() === "arrays" &&
      "arrays" in options &&
      options.arrays === "concat"
    );
  } catch {
    // Options no call could read are `n/a`, not a crash of the whole run.
    return false;
  }
}

/** Accept exactly one argument, a string; other cases are `n/a`. */
export function isLoneString(args: readonly unknown[]): boolean {
  return args.length === 1 && typeof args[0] === "string";
}

/** Accept exactly two values and no options; other cases are `n/a`. */
export function isPair(args: readonly unknown[]): boolean {
  return args.length === 2;
}

/**
 * Whether a `pluralize` case is a word and a numeric count whose options pass
 * the probe's own test, so each probe runs only the cases its call can express.
 *
 * @returns whether the probe can run the case.
 */
export function isPluralizeCase(
  [word, count, options]: readonly unknown[],
  hasOptions: (options: PluralizeCaseOptions | undefined) => boolean
): boolean {
  return (
    typeof word === "string" &&
    typeof count === "number" &&
    (options === undefined || isPluralizeCaseOptions(options)) &&
    hasOptions(options)
  );
}

/**
 * Whether a value is a `pluralize` case's options object, with each key it
 * holds of the right type.
 *
 * @returns whether the value is the options.
 */
export function isPluralizeCaseOptions(
  value: unknown
): value is PluralizeCaseOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const { includeCount, plural } = value as Record<string, unknown>;

  return (
    (includeCount === undefined || typeof includeCount === "boolean") &&
    (plural === undefined || typeof plural === "string")
  );
}

/**
 * Whether a `range` case fits a call and is short enough to build: `[end]`
 * only if the call has that form, `[start, end]`, or `[start, end, options]`
 * holding only `optionKeys`; never `[end, options]`.
 *
 * - An options object that can't be read (a revoked proxy, a throwing trap)
 *   is `n/a` for a positional call, which never receives it, since the
 *   probe's own read of `step` would throw first; a call that takes the
 *   object whole runs it.
 *
 * - The span is bounded by `isBoundedRange`.
 *
 * @returns whether the probe can run the case.
 */
export function isRangeCase(check: RangeCaseCheck): boolean {
  return hasRangeForm(check) && isBoundedRange(check);
}

/** Accept only a string first argument; other cases are `n/a`. */
export function isString([value]: readonly unknown[]): boolean {
  return typeof value === "string";
}

/**
 * Turn a `keyBy` case's key into the function a probe calls on each item.
 *
 * - A key function is called as it is; a property name `key` becomes
 *   `(item) => item[key]`, the arrow a caller would write for a library that
 *   takes only a function.
 *
 * @returns the function that reads an item's key.
 */
export function keyGetter(key: unknown): (item: unknown) => unknown {
  if (typeof key === "function") {
    return (item) => {
      const itemKey: unknown = Reflect.apply(key, undefined, [item]);

      return itemKey;
    };
  }

  return (item) => (item as Record<PropertyKey, unknown>)[key as PropertyKey];
}

/**
 * Mark what a deep clone copied and what it shared, for a `deepClone` column.
 *
 * - Like `markReferences`, plus `Symbol(shared)` for any object the clone
 *   holds from its source, and `Symbol(hole)` for an array's missing index,
 *   which would otherwise encode as `null`.
 *
 * - A `Map`, `Set`, or `Error` is spelled out (`{ Map: [[key, value]] }`,
 *   `{ Set: [member] }`, `{ Error: { cause, message, name } }`), so a shared
 *   key, member, or cause shows; a brand check finds one from any realm.
 *
 * - Every own key shows: a symbol key as `[Symbol(key)]`, a non-enumerable
 *   key with a ` (non-enumerable)` suffix, and a null-prototype object is
 *   wrapped as `{ "null-prototype": { … } }`.
 *
 * @returns the marked copy, safe to encode.
 */
export function markClone({ clone, source }: CloneComparison): unknown {
  return markWithin({
    ancestors: [],
    seen: new Set(),
    sourceObjects: collectObjects(source),
    value: clone,
  });
}

/**
 * Mark a `keyBy` result, showing its prototype and the items it holds.
 *
 * - Every tool shares the items it keys, so nothing is marked shared: an item
 *   shows as its data, and a winning duplicate shows which item it is.
 *
 * - A null-prototype result is wrapped as `{ "null-prototype": { … } }`, as
 *   `markClone` wraps one, and a `Map` is spelled out.
 *
 * @returns the marked result, safe to encode.
 */
export function markKeyed(value: unknown): unknown {
  return markClone({ clone: value, source: [] });
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
  return markWithin({ ancestors: [], seen: new Set(), value });
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
 * Spread a `range` case into a positional call's arguments: `[end]`,
 * `[start, end]`, or `[start, end, step]`, reading `step` from the options.
 *
 * @returns the arguments, in the call's order.
 * @throws whatever reading the options' `step` throws.
 */
export function rangeArguments(args: readonly unknown[]): unknown[] {
  const [start, end, options] = args;

  if (args.length < 3) {
    return [...args];
  }

  return [start, end, (options as Record<string, unknown>).step];
}

/**
 * Read a numeric `range` case as its start, end, and step, the way a call
 * that counts would: a one-argument case starts at `0`, a missing step is
 * `1`, and a bigint counts as its `Number`.
 *
 * @returns the three numbers, or `undefined` for a case whose arguments
 *   aren't all numbers or whose options can't be read, which every tool
 *   rejects before it loops.
 */
export function readRangeSpan(args: readonly unknown[]): RangeSpan | undefined {
  let parts: unknown[];

  try {
    parts = rangeArguments(args);
  } catch {
    return undefined;
  }

  const [start, end, step = 1] = (
    args.length === 1 ? [0, ...parts] : parts
  ).map((value) => (typeof value === "bigint" ? Number(value) : value));

  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    typeof step !== "number"
  ) {
    return undefined;
  }

  return { end, start, step };
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

/**
 * Gather every object reachable from a value: every own key's value, a typed
 * array's buffer, and `Map` and `Set` contents; a read that throws skips just
 * that part.
 *
 * @returns the objects found.
 */
function collectObjects(root: unknown): Set<object> {
  const found = new Set<object>();
  const pending: unknown[] = [root];

  while (pending.length > 0) {
    const value = pending.pop();

    if (
      (typeof value !== "object" && typeof value !== "function") ||
      value === null ||
      found.has(value)
    ) {
      continue;
    }

    found.add(value);
    pending.push(...readContents(value));
  }

  return found;
}

/**
 * Spell out one object for `markClone`.
 *
 * @returns the object's marked description, or the object itself for one it
 * can't spell out, for the codec to show by its tag.
 */
function describeClone({
  isPlain,
  prototype,
  sourceObjects,
  value,
  visit,
}: CloneDescription): unknown {
  if (Array.isArray(value)) {
    return Array.from(value, (item: unknown, index) =>
      index in value ? visit(item) : HOLE
    );
  }

  if (isPlain) {
    const entries = describeOwnEntries({ value, visit });

    return prototype === null ? { "null-prototype": entries } : entries;
  }

  if (Error.isError(value)) {
    return { Error: describeError({ value, visit }) };
  }

  if (isMap(value)) {
    return { Map: readMapEntries(value).map((entry) => entry.map(visit)) };
  }

  if (isSet(value)) {
    return { Set: readSetMembers(value).map(visit) };
  }

  if (ArrayBuffer.isView(value)) {
    return describeView({ sourceObjects, value });
  }

  return describeValueLike(value) ?? value;
}

/**
 * Spell out an error's `name` and own keys for `markClone`, leaving out its
 * `stack`, whose text names file paths.
 *
 * @returns the error's parts, each marked.
 */
function describeError({
  value,
  visit,
}: Pick<CloneDescription, "value" | "visit">): Record<string, unknown> {
  return {
    name: readGuarded(() => Reflect.get(value, "name")),
    ...describeOwnEntries({
      plainKeys: ERROR_KEYS,
      skippedKeys: new Set(["stack"]),
      value,
      visit,
    }),
  };
}

/**
 * List an object's own keys for `markClone`, reading each descriptor so no
 * getter runs.
 *
 * - A symbol key shows as `[Symbol(key)]`, a non-enumerable key with a
 *   ` (non-enumerable)` suffix, and a label already used gets a ` #2`.
 *
 * - A getter shows as `Symbol(getter)`, and a descriptor that can't be read
 *   as `Symbol(threw)`.
 *
 * @returns the labeled, marked entries.
 */
function describeOwnEntries({
  plainKeys,
  skippedKeys,
  value,
  visit,
}: OwnEntriesRead): Record<string, unknown> {
  const labelCounts = new Map<string, number>();

  try {
    return Object.fromEntries(
      Reflect.ownKeys(value).flatMap((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);

        if (skippedKeys?.has(key) === true || descriptor === undefined) {
          return [];
        }

        const name = typeof key === "symbol" ? `[${String(key)}]` : key;
        const isShownPlain =
          descriptor.enumerable === true || plainKeys?.has(key) === true;

        const baseLabel = isShownPlain ? name : `${name} (non-enumerable)`;
        const count = (labelCounts.get(baseLabel) ?? 0) + 1;
        const item: unknown = descriptor.value;

        labelCounts.set(baseLabel, count);

        return [
          [
            count === 1 ? baseLabel : `${baseLabel} #${count}`,
            "get" in descriptor || "set" in descriptor ? GETTER : visit(item),
          ],
        ];
      })
    );
  } catch {
    return { "": THREW };
  }
}

/**
 * Spell out a value-like built-in for `markClone`: a `Date` by its time,
 * a `RegExp` by its text, a boxed primitive by its value, and an
 * `ArrayBuffer` by its bytes.
 *
 * @returns `{ [kind]: contents }`, or `undefined` for any other object.
 */
function describeValueLike(value: object): Record<string, unknown> | undefined {
  for (const [kind, read] of BUILT_IN_READERS) {
    try {
      return { [kind]: read(value) };
    } catch {
      // Not this kind; try the next.
    }
  }

  return undefined;
}

/**
 * Spell out a typed array or `DataView` for `markClone`: its items, or a
 * `DataView`'s bytes, plus `buffer: Symbol(shared)` when its bytes are the
 * source's own.
 *
 * @returns the view's marked description.
 */
function describeView({
  sourceObjects,
  value,
}: {
  /**
   * The typed array or `DataView`.
   *
   * @example `Uint8Array.of(1, 2)`
   */
  value: ArrayBufferView;
} & Pick<CloneDescription, "sourceObjects">): Record<string, unknown> {
  const tag: unknown = Reflect.get(
    TYPED_ARRAY_PROTOTYPE,
    Symbol.toStringTag,
    value
  );

  const contents: unknown =
    typeof tag === "string"
      ? Reflect.apply(Array.prototype.slice, value, [])
      : Array.from(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        );

  const description = {
    [typeof tag === "string" ? tag : "DataView"]: contents,
  };

  return sourceObjects.has(value.buffer)
    ? { ...description, buffer: SHARED }
    : description;
}

/**
 * Whether a `range` case has a form the call takes, with readable options.
 *
 * @returns whether the case's arguments fit the call.
 */
function hasRangeForm({
  args,
  hasEndForm,
  hasOptionsParameter,
  optionKeys,
}: Omit<RangeCaseCheck, "shouldBoundEveryCount">): boolean {
  if (args.length === 1) {
    return hasEndForm;
  }

  const [, end, options] = args;

  if (args.length === 2) {
    // `[end, options]` is safe-fns' own form; no other tool has it.
    return end === null || typeof end !== "object";
  }

  if (
    args.length !== 3 ||
    optionKeys.length === 0 ||
    typeof options !== "object" ||
    options === null
  ) {
    return false;
  }

  try {
    if (!Object.keys(options).every((key) => optionKeys.includes(key))) {
      return false;
    }

    if (!hasOptionsParameter) {
      // The probe spreads each key itself, a read a `get` trap can throw on.
      for (const key of optionKeys) {
        Reflect.get(options, key);
      }
    }

    return true;
  } catch {
    // Only a call that takes the object whole ever receives it.
    return hasOptionsParameter;
  }
}

/**
 * Whether a `range` case's span is safe for a probe to build.
 *
 * - The count is `|end - start| / |step|`, counting either way, read as
 *   `readRangeSpan` reads the case, with a string read as its `Number`, since
 *   lodash and Underscore coerce one. A count that can't be computed (`NaN`,
 *   `null`) is accepted: no tool loops on it.
 *
 * - A count up to `MAX_RANGE_LENGTH` is accepted. Past it, a call that sizes
 *   or grows a real array fails with `RangeError` once the count reaches the
 *   array limit, 2^32, so only a count below that is `n/a`: that array would
 *   be built, and could exhaust memory.
 *
 * - With `shouldBoundEveryCount`, a zero step and every longer count are
 *   `n/a`, since such a call never fails on its own.
 *
 * @returns whether the probe can run the case.
 */
function isBoundedRange({
  args,
  shouldBoundEveryCount,
}: RangeBoundCheck): boolean {
  const span = readRangeSpan(args.map(numberFromString));

  if (span === undefined) {
    return true;
  }

  const { end, start, step } = span;

  if (step === 0) {
    return !shouldBoundEveryCount;
  }

  // Divide first: `end - start` overflows near `Number.MAX_VALUE`.
  const count = Math.abs(end / step - start / step);

  if (Number.isNaN(count) || count <= MAX_RANGE_LENGTH) {
    return true;
  }

  return !shouldBoundEveryCount && count >= ARRAY_LENGTH_LIMIT;
}

/** Whether a value is a `Map` from any realm, by `Map.prototype.has`. */
function isMap(value: object): boolean {
  try {
    Map.prototype.has.call(value, undefined);

    return true;
  } catch {
    return false;
  }
}

/** Whether a value is a `Set` from any realm, by `Set.prototype.has`. */
function isSet(value: object): boolean {
  try {
    Set.prototype.has.call(value, undefined);

    return true;
  } catch {
    return false;
  }
}

/**
 * Copy one value for `markReferences` or `markClone`, given the path that
 * reached it; `sourceObjects` turns on what only `markClone` shows.
 *
 * @returns the marked copy.
 */
function markWithin(walk: ReferenceWalk): unknown {
  const { ancestors, seen, sourceObjects, value } = walk;

  if (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    sourceObjects?.has(value) === true
  ) {
    return SHARED;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (ancestors.includes(value)) {
    return CYCLE;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  const isArray = Array.isArray(value);
  const isPlain =
    isArray || prototype === Object.prototype || prototype === null;

  if (!isPlain && sourceObjects === undefined) {
    return value;
  }

  if (seen.has(value)) {
    return REPEAT;
  }

  seen.add(value);

  const path = [...ancestors, value];
  const visit = (item: unknown): unknown =>
    markWithin({ ...walk, ancestors: path, value: item });

  if (sourceObjects !== undefined) {
    return describeClone({ isPlain, prototype, sourceObjects, value, visit });
  }

  if (isArray) {
    return value.map(visit);
  }

  const entries = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, visit(item)])
  );

  // `Object.assign` sets keys on a null-prototype target, where `__proto__`
  // is an ordinary key, so the copy keeps every entry.
  return prototype === null
    ? Object.assign(Object.create(null) as object, entries)
    : entries;
}

/**
 * Read a string as its `Number`, as lodash and Underscore coerce a `range`
 * argument; any other value is returned as it is.
 *
 * @returns the number, or the value unchanged.
 */
function numberFromString(value: unknown): unknown {
  return typeof value === "string" ? Number(value) : value;
}

/** Copy an `ArrayBuffer`'s bytes; `slice` throws for any other object. */
function readBytes(value: object): number[] {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the brand check
  const copy: unknown = Reflect.apply(ArrayBuffer.prototype.slice, value, [0]);

  return copy instanceof ArrayBuffer ? Array.from(new Uint8Array(copy)) : [];
}

/**
 * Read what an object holds, for `collectObjects`: a `Map`'s keys and
 * values, a `Set`'s members, a typed array's buffer, or every own key's
 * value.
 *
 * @returns the values read; one whose read throws is left out.
 */
function readContents(value: object): unknown[] {
  try {
    if (isMap(value)) {
      return readMapEntries(value).flat();
    }

    if (isSet(value)) {
      return readSetMembers(value);
    }

    const ownValues = Reflect.ownKeys(value).flatMap((key) => {
      try {
        return [readKey({ key, value })];
      } catch {
        return [];
      }
    });

    return ArrayBuffer.isView(value) ? [...ownValues, value.buffer] : ownValues;
  } catch {
    // A trap that throws hides everything behind it.
    return [];
  }
}

/** Run a read for `markClone`, marking one that throws. */
function readGuarded(read: () => unknown): unknown {
  try {
    return read();
  } catch {
    return THREW;
  }
}

/** Read one own key's value, through its getter if it has one. */
function readKey({ key, value }: KeyRead): unknown {
  const item: unknown = Reflect.get(value, key);

  return item;
}

/** Read a brand-checked `Map`'s entries, from any realm. */
function readMapEntries(map: object): unknown[][] {
  const entries: Iterable<[unknown, unknown]> = Map.prototype.entries.call(
    map as Map<unknown, unknown>
  );

  return Array.from(entries, ([key, item]) => [key, item]);
}

/** Read an error's `message`, marking one whose getter throws. */
function readMessage(error: Error): unknown {
  try {
    return error.message;
  } catch {
    return UNREADABLE_MESSAGE;
  }
}

/** Read a brand-checked `Set`'s members, from any realm. */
function readSetMembers(set: object): unknown[] {
  const members: Iterable<unknown> = Set.prototype.values.call(
    set as Set<unknown>
  );

  return Array.from(members);
}
