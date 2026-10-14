/*
 * The portable value format shared by every research adapter, in every
 * language.
 *
 * - Plain JSON passes through unchanged; values JSON can't hold are
 *   single-key objects whose key starts with `$`.
 *
 * - A data object with a `$` key is wrapped in `$object`, so data can never
 *   pass for a tag.
 *
 * - The Python twin lives in `research/adapters/research_codec.py`; the
 *   `codec` case file checks that both decode and re-encode identically.
 */

/** Decoding options. */
export type DecodeOptions = {
  /**
   * Builds the value a `{ "$js": name }` tag names.
   *
   * @example `(name) => factories[name]()`
   */
  resolveJs: (name: string) => unknown;
};

/** A JSON value, possibly holding tagged objects. */
export type EncodedValue =
  | { [key: string]: EncodedValue }
  | boolean
  | EncodedValue[]
  | null
  | number
  | string;

const BIGINT_PATTERN = /^-?\d+$/u;

const INVISIBLE_PATTERN =
  /[\p{Control}\p{Default_Ignorable_Code_Point}\p{White_Space}\u2800]/gu;

/** The spellings `$number` accepts, each with its value. */
const SPECIAL_NUMBERS: ReadonlyMap<string, number> = new Map([
  ["-0", -0],
  ["-Infinity", Number.NEGATIVE_INFINITY],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["NaN", Number.NaN],
]);

/**
 * Decode a value from the portable format.
 *
 * @returns the value the encoding describes.
 * @throws Error for a malformed tag.
 */
export function decodeValue(
  encoded: EncodedValue,
  options: DecodeOptions
): unknown {
  if (Array.isArray(encoded)) {
    return encoded.map((item) => decodeValue(item, options));
  }

  if (encoded === null || typeof encoded !== "object") {
    return encoded;
  }

  const keys = Object.keys(encoded);
  const tag = keys.find((key) => key.startsWith("$"));

  if (tag === undefined) {
    return decodeEntries(encoded, options);
  }

  if (keys.length !== 1) {
    throw new Error(`a tag must be an object's only key: ${tag}`);
  }

  return decodeTag({ options, payload: encoded[tag], tag });
}

/**
 * Encode a value into the portable format.
 *
 * - Anything the format has no tag for (a `Map`, a function, a class
 *   instance) is described by `$repr`, which never decodes.
 *
 * @returns the encoding.
 */
export function encodeValue(value: unknown): EncodedValue {
  switch (typeof value) {
    case "bigint": {
      return { $bigint: String(value) };
    }

    case "boolean":
    case "string": {
      return value;
    }

    case "number": {
      return encodeNumber(value);
    }

    case "undefined": {
      return { $undefined: true };
    }

    default: {
      return encodeObject(value);
    }
  }
}

/**
 * Check for a non-null, non-array object.
 *
 * @returns whether `value` can be read as a record of its keys.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Render an encoded value as a short, readable literal for a Markdown table.
 *
 * - Invisible characters (whitespace, format characters, the braille blank)
 *   are escaped as `\u{…}`, so a cell never hides what it holds.
 *
 * @returns the literal, without surrounding code-span backticks.
 */
export function renderValue(encoded: EncodedValue): string {
  if (Array.isArray(encoded)) {
    return `[${encoded.map((item) => renderValue(item)).join(", ")}]`;
  }

  if (typeof encoded === "string") {
    // Escape `\` and `"` first, so a literal `\u{A0}` can't pass for the
    // escaped character, nor a quote end the string early.
    return `"${escapeInvisible(encoded.replaceAll(/["\\]/gu, String.raw`\$&`))}"`;
  }

  if (encoded === null || typeof encoded !== "object") {
    return String(encoded);
  }

  const [tag] = Object.keys(encoded);

  if (tag?.startsWith("$") === true) {
    return renderTag({ payload: encoded[tag], tag });
  }

  return renderEntries(encoded);
}

/** Decode every value of an untagged object, keeping its keys. */
function decodeEntries(
  encoded: Record<string, EncodedValue>,
  options: DecodeOptions
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(encoded).map(([key, item]) => [
      key,
      decodeValue(item, options),
    ])
  );
}

/** Decode one tagged object, given its tag and payload. */
function decodeTag({
  options,
  payload,
  tag,
}: {
  options: DecodeOptions;
  payload: EncodedValue | undefined;
  tag: string;
}): unknown {
  if (tag === "$bigint" && typeof payload === "string") {
    if (!BIGINT_PATTERN.test(payload)) {
      throw new Error(`not an integer: ${payload}`);
    }

    return BigInt(payload);
  }

  if (tag === "$js" && typeof payload === "string") {
    return options.resolveJs(payload);
  }

  if (tag === "$number" && typeof payload === "string") {
    const special = SPECIAL_NUMBERS.get(payload);

    if (special === undefined) {
      throw new Error(`not a special number: ${payload}`);
    }

    return special;
  }

  if (tag === "$object" && isEntries(payload)) {
    return decodeEntries(payload, options);
  }

  if (tag === "$undefined" && payload === true) {
    return undefined;
  }

  throw new Error(`unknown tag or bad payload: ${tag}`);
}

/** Name a value the format can't spell, for `$repr`. */
function describe(value: object | symbol): string {
  try {
    if (typeof value === "symbol") {
      return value.toString();
    }

    if (typeof value === "function") {
      return "function";
    }

    return Object.prototype.toString.call(value);
  } catch {
    return "an uninspectable value";
  }
}

/** Encode a number, tagging the values JSON can't hold. */
function encodeNumber(value: number): EncodedValue {
  if (Object.is(value, -0)) {
    return { $number: "-0" };
  }

  if (Number.isFinite(value)) {
    return value;
  }

  return { $number: String(value) };
}

/** Encode an object, array, symbol, or function. */
function encodeObject(value: unknown): EncodedValue {
  if (value === null) {
    return null;
  }

  try {
    if (Array.isArray(value)) {
      return value.map((item) => encodeValue(item));
    }

    if (isPlainRecord(value)) {
      const entries = Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, encodeValue(item)])
      );

      return Object.keys(entries).some((key) => key.startsWith("$"))
        ? { $object: entries }
        : entries;
    }
  } catch {
    // A trapping proxy or getter: describe it below instead.
  }

  return { $repr: describe(value as object | symbol) };
}

/** Spell every invisible character but the space as `\u{…}`. */
function escapeInvisible(text: string): string {
  return text.replaceAll(INVISIBLE_PATTERN, (character) =>
    character === " "
      ? character
      : `\\u{${Number(character.codePointAt(0)).toString(16).toUpperCase()}}`
  );
}

/** Check that a payload is a JSON object, not an array or primitive. */
function isEntries(
  payload: EncodedValue | undefined
): payload is Record<string, EncodedValue> {
  return isRecord(payload);
}

/** Check for an object whose prototype is `Object.prototype` or `null`. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/** Show a tag payload as text: a string as-is, anything else as JSON. */
function payloadText(payload: EncodedValue | undefined): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

/** Render an object literal from its encoded entries. */
function renderEntries(encoded: Record<string, EncodedValue>): string {
  const entries = Object.entries(encoded).map(
    ([key, item]) => `${JSON.stringify(key)}: ${renderValue(item)}`
  );

  return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
}

/** Render one tagged value as its JavaScript literal or a `‹name›`. */
function renderTag({
  payload,
  tag,
}: {
  payload: EncodedValue | undefined;
  tag: string;
}): string {
  if (tag === "$bigint" || tag === "$number") {
    return `${payloadText(payload)}${tag === "$bigint" ? "n" : ""}`;
  }

  if (tag === "$object" && isEntries(payload)) {
    return renderEntries(payload);
  }

  if (tag === "$undefined") {
    return "undefined";
  }

  // `$js` and `$repr` name a value rather than spell it.
  return `‹${payloadText(payload)}›`;
}
