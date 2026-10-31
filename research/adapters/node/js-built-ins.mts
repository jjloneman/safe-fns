import { unescape } from "node:querystring";
import { isDeepStrictEqual } from "node:util";

import type { Tool } from "./tool.mts";

import {
  callJsonParse,
  hasNoOptions,
  hasOnlyOptions,
  isLoneString,
  isPair,
  isString,
  keyGetter,
  markClone,
  markKeyed,
  markReferences,
  summarizeError,
} from "./tool.mts";
import { storageProbes } from "./web-storage.mts";

/** The locale a first-letter case can carry in its options. */
type LocaleOptions = {
  /**
   * The BCP 47 tag passed to `toLocaleUpperCase`.
   *
   * @example "tr"
   */
  locale?: string;
};

/** A call to run with `TZ` set, for `inTimeZone`. */
type TimeZoneRun<T> = {
  /**
   * The call, run while `TZ` is set.
   *
   * @example `() => new Date("2024-01-01T12:00").toISOString()`
   */
  run: () => T;

  /**
   * The IANA time zone to set.
   *
   * @example "America/New_York"
   */
  zone: string;
};

/** Node's `sessionStorage`, which needs no configuration. */
const NODE_SESSION_STORAGE = storageProbes({
  read: () => globalThis.sessionStorage,
  receiver: "sessionStorage",
  suffix: "",
});

/**
 * Node's `localStorage`, run without `--localstorage-file`, as a server
 * renderer usually is: the global is `undefined`.
 */
const NODE_UNCONFIGURED_LOCAL_STORAGE = storageProbes({
  read: (): unknown => Reflect.get(globalThis, "localStorage"),
  receiver: "localStorage",
  suffix: " (no --localstorage-file)",
});

/**
 * The runtime's own globals, versioned by the Node release; `JSON.parse` on a
 * scalar is the JSON column's.
 */
export const JS_BUILT_INS: Tool = {
  functions: {
    codec: [{ call: "value", run: ([value]) => value }],
    decodeBase64: [
      {
        accepts: isString,
        call: "atob(value)",
        run: ([value]) => atob(value as string),
      },
      {
        accepts: isString,
        call: 'Buffer.from(value, "base64").toString("utf8")',
        run: ([value]) =>
          Buffer.from(value as string, "base64").toString("utf8"),
      },
      {
        accepts: isString,
        call: 'new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.fromBase64(value))',
        run: ([value]) =>
          new TextDecoder("utf-8", { fatal: true }).decode(
            Uint8Array.fromBase64(value as string)
          ),
      },
      {
        accepts: isString,
        call: 'new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.fromBase64(value, { alphabet: "base64url" }))',
        run: ([value]) =>
          new TextDecoder("utf-8", { fatal: true }).decode(
            Uint8Array.fromBase64(value as string, { alphabet: "base64url" })
          ),
      },
    ],
    deepClone: [
      {
        accepts: hasNoOptions,
        call: "structuredClone(value)",
        run: ([value]) =>
          markClone({ clone: structuredClone(value), source: value }),
      },
      {
        accepts: hasNoOptions,
        call: "JSON.parse(JSON.stringify(value))",
        run: ([value]) =>
          markClone({
            clone: callJsonParse(JSON.stringify(value)),
            source: value,
          }),
      },
    ],
    deepMerge: [
      {
        accepts: isPair,
        call: "{ ...defaults, ...overrides }",
        run: ([defaults, overrides]) =>
          markClone({
            clone: { ...(defaults as object), ...(overrides as object) },
            source: [defaults, overrides],
          }),
      },
    ],
    deepSortObject: [
      {
        accepts: isString,
        call: "JSON.stringify(JSON.parse(value))",
        run: ([value]) => JSON.stringify(callJsonParse(value as string)),
      },
    ],
    encodeBase64: [
      { call: "btoa(value)", run: ([value]) => btoa(value as string) },
      {
        accepts: isString,
        call: "new TextEncoder().encode(value).toBase64()",
        run: ([value]) => new TextEncoder().encode(value as string).toBase64(),
      },
      {
        accepts: isBytes,
        call: "value.toBase64()",
        run: ([value]) => (value as Uint8Array).toBase64(),
      },
      {
        accepts: isBufferSource,
        call: 'Buffer.from(value).toString("base64")',
        run: ([value]) => bufferOf(value).toString("base64"),
      },
    ],
    getErrorMessage: [
      { call: "String(value)", run: ([value]) => String(value) },
    ],
    isDeepEqual: [
      {
        accepts: isPair,
        call: "util.isDeepStrictEqual(a, b)",
        run: ([a, b]) => isDeepStrictEqual(a, b),
      },
      {
        accepts: isPair,
        call: "JSON.stringify(a) === JSON.stringify(b)",
        run: ([a, b]) => JSON.stringify(a) === JSON.stringify(b),
      },
    ],
    keyBy: [
      {
        accepts: isPair,
        call: "Object.fromEntries(items.map((item) => [getKey(item), item]))",
        run: ([items, key]) => {
          const getKey = keyGetter(key);

          return markKeyed(
            Object.fromEntries(
              (items as readonly unknown[]).map((item) => [getKey(item), item])
            )
          );
        },
      },
      {
        accepts: isPair,
        call: "new Map(items.map((item) => [getKey(item), item]))",
        run: ([items, key]) => {
          const getKey = keyGetter(key);

          return markKeyed(
            new Map(
              (items as readonly unknown[]).map((item) => [getKey(item), item])
            )
          );
        },
      },
      {
        accepts: isPair,
        call: "Object.groupBy(items, getKey)",
        run: ([items, key]) =>
          markKeyed(
            Object.groupBy(
              items as readonly unknown[],
              keyGetter(key) as (item: unknown) => PropertyKey
            )
          ),
      },
    ],
    lowerFirst: [
      {
        accepts: isLoneString,
        call: "value.charAt(0).toLowerCase() + value.slice(1)",
        run: ([value]) =>
          (value as string).charAt(0).toLowerCase() +
          (value as string).slice(1),
      },
      {
        accepts: isLoneString,
        call: 'first.toLowerCase() + rest.join("") ([first, ...rest] = value)',
        run: ([value]) => {
          const [first = "", ...rest] = value as string;

          return first.toLowerCase() + rest.join("");
        },
      },
      {
        accepts: (args) => hasOnlyOptions(args, ["locale"]),
        call: "value.charAt(0).toLocaleLowerCase(options.locale) + value.slice(1)",
        run: ([value, options]) =>
          (value as string)
            .charAt(0)
            .toLocaleLowerCase((options as LocaleOptions).locale) +
          (value as string).slice(1),
      },
    ],
    pluralize: [
      {
        accepts: (args) =>
          args.length === 2 &&
          typeof args[0] === "string" &&
          typeof args[1] === "number",
        call: 'new Intl.PluralRules("en").select(count)',
        run: ([, count]) => new Intl.PluralRules("en").select(count as number),
      },
    ],
    safeDateToIsoString: [
      {
        accepts: ([value]) => value instanceof Date,
        call: "value.toISOString()",
        run: ([value]) => (value as Date).toISOString(),
      },
      {
        call: "new Date(value).toISOString()",
        run: ([value]) => new Date(value as number).toISOString(),
      },
    ],
    safeDecodeUriComponent: [
      {
        call: "decodeURIComponent(value)",
        run: ([value]) => decodeURIComponent(value as string),
      },
      {
        call: "decodeURI(value)",
        run: ([value]) => decodeURI(value as string),
      },
      {
        call: "querystring.unescape(value)",
        run: ([value]) => unescape(value as string),
      },
    ],
    safeEncodeUriComponent: [
      {
        call: "encodeURIComponent(value)",
        run: ([value]) => encodeURIComponent(value as string),
      },
      {
        call: "encodeURI(value)",
        run: ([value]) => encodeURI(value as string),
      },
    ],
    safeJsonStringify: [
      {
        call: "JSON.stringify(value)",
        run: ([value]) => JSON.stringify(value),
      },
    ],
    safeObjectHasOwn: [
      {
        call: "Object.hasOwn(object, key)",
        run: ([object, key]) => Object.hasOwn(object as object, key as string),
      },
      {
        call: "key in object",
        run: ([object, key]) => (key as string) in (object as object),
      },
    ],
    safeParseBigInt: [
      { call: "BigInt(value)", run: ([value]) => BigInt(value as string) },
    ],
    safeParseDate: [
      {
        call: "new Date(value).toISOString()",
        run: ([value]) => new Date(value as string).toISOString(),
      },
      {
        call: 'new Date(value).toISOString() (TZ="America/New_York")',
        run: ([value]) =>
          inTimeZone({
            run: () => new Date(value as string).toISOString(),
            zone: "America/New_York",
          }),
      },
    ],
    safeParseInt: [
      {
        call: "Number.parseInt(value, 10)",
        run: ([value]) => Number.parseInt(value as string, 10),
      },
    ],
    safeParseJson: [
      {
        call: "JSON.parse(value)",
        run: ([value]) => callJsonParse(value as string),
      },
    ],
    safeParseNumber: [
      { call: "Number(value)", run: ([value]) => Number(value) },
      {
        call: "Number.parseFloat(value)",
        run: ([value]) => Number.parseFloat(value as string),
      },
    ],
    safeParseRegExp: [
      {
        call: "String(new RegExp(value, flags))",
        run: ([value, flags]) =>
          String(new RegExp(value as string, flags as string | undefined)),
      },
    ],
    safeParseString: [
      { call: "String(value)", run: ([value]) => String(value) },
      {
        call: "String(value).trim()",
        run: ([value]) => String(value).trim(),
      },
    ],
    safeParseUrl: [
      {
        call: "new URL(value, base).href",
        run: ([value, base]) =>
          new URL(value as string, base as string | undefined).href,
      },
      {
        call: "URL.parse(value, base)?.href",
        run: ([value, base]) =>
          URL.parse(value as string, base as string | undefined)?.href,
      },
    ],
    safeStorageGetItem: [
      ...NODE_SESSION_STORAGE.safeStorageGetItem,
      ...NODE_UNCONFIGURED_LOCAL_STORAGE.safeStorageGetItem,
    ],
    safeStorageRemoveItem: [
      ...NODE_SESSION_STORAGE.safeStorageRemoveItem,
      ...NODE_UNCONFIGURED_LOCAL_STORAGE.safeStorageRemoveItem,
    ],
    safeStorageSetItem: [
      ...NODE_SESSION_STORAGE.safeStorageSetItem,
      ...NODE_UNCONFIGURED_LOCAL_STORAGE.safeStorageSetItem,
    ],
    safeStructuredClone: [
      {
        call: "structuredClone(value)",
        run: ([value]) => markReferences(structuredClone(value)),
      },
    ],
    toBasicAscii: [
      {
        accepts: isString,
        call: 'value.normalize("NFD").replace(/\\p{M}/gu, "")',
        run: ([value]) =>
          (value as string).normalize("NFD").replace(/\p{M}/gu, ""),
      },
      {
        accepts: isString,
        call: 'value.normalize("NFKD").replace(/\\p{M}/gu, "")',
        run: ([value]) =>
          (value as string).normalize("NFKD").replace(/\p{M}/gu, ""),
      },
    ],
    toError: [
      {
        call: "new Error(value) → { message, unchanged }",
        run: ([value]) =>
          summarizeError({ error: new Error(value as string), input: value }),
      },
    ],
    trimBlank: [
      {
        accepts: isString,
        call: "value.trim()",
        run: ([value]) => (value as string).trim(),
      },
    ],
    upperFirst: [
      {
        accepts: isLoneString,
        call: "value.charAt(0).toUpperCase() + value.slice(1)",
        run: ([value]) =>
          (value as string).charAt(0).toUpperCase() +
          (value as string).slice(1),
      },
      {
        accepts: isLoneString,
        call: 'first.toUpperCase() + rest.join("") ([first, ...rest] = value)',
        run: ([value]) => {
          const [first = "", ...rest] = value as string;

          return first.toUpperCase() + rest.join("");
        },
      },
      {
        accepts: (args) => hasOnlyOptions(args, ["locale"]),
        call: "value.charAt(0).toLocaleUpperCase(options.locale) + value.slice(1)",
        run: ([value, options]) =>
          (value as string)
            .charAt(0)
            .toLocaleUpperCase((options as LocaleOptions).locale) +
          (value as string).slice(1),
      },
      {
        accepts: (args) =>
          hasOnlyOptions(args, ["lowerRest"]) &&
          (args[1] as Record<string, unknown>).lowerRest === true,
        call: 'first.toUpperCase() + rest.join("").toLowerCase() ([first, ...rest] = value)',
        run: ([value]) => {
          const [first = "", ...rest] = value as string;

          return first.toUpperCase() + rest.join("").toLowerCase();
        },
      },
    ],
  },
  name: "JS built-ins",
  tier: 1,
  version: process.version,
};

/** Wrap bytes, or text, in a Buffer, as `Buffer.from` reads each. */
function bufferOf(value: unknown): Buffer {
  if (typeof value === "string") {
    return Buffer.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  const view = value as ArrayBufferView;

  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

/**
 * Run a call with `TZ` set, restoring it after, since Node reads `TZ` again
 * whenever it changes.
 *
 * @returns what the call returned.
 */
function inTimeZone<T>({ run, zone }: TimeZoneRun<T>): T {
  const previous = process.env.TZ;

  process.env.TZ = zone;

  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  }
}

/** Accept text or bytes: a string, an `ArrayBuffer`, or a view of one. */
function isBufferSource([value]: readonly unknown[]): boolean {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

/** Accept a `Uint8Array`, the one type `toBase64` is a method of. */
function isBytes([value]: readonly unknown[]): boolean {
  return value instanceof Uint8Array;
}
