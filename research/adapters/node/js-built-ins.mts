import type { Tool } from "./tool.mts";

import {
  callJsonParse,
  isString,
  markReferences,
  summarizeError,
} from "./tool.mts";
import { storageProbes } from "./web-storage.mts";

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
    deepSortObject: [
      {
        accepts: isString,
        call: "JSON.stringify(JSON.parse(value))",
        run: ([value]) => JSON.stringify(callJsonParse(value as string)),
      },
    ],
    getErrorMessage: [
      { call: "String(value)", run: ([value]) => String(value) },
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
    safeParseInteger: [
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
    toError: [
      {
        call: "new Error(value) → { message, unchanged }",
        run: ([value]) =>
          summarizeError({ error: new Error(value as string), input: value }),
      },
    ],
  },
  name: "JS built-ins",
  tier: 1,
  version: process.version,
};
