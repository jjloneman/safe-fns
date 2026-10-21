import { JSDOM } from "jsdom";
import { parseInteger } from "jsdom/lib/jsdom/living/helpers/strings.js";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";
import { storageProbes } from "./web-storage.mts";

/** A document with no URL, whose origin is opaque. */
const OPAQUE_WINDOW = new JSDOM("").window;

/** A document served from a real origin, so its storage is reachable. */
const ORIGIN_WINDOW = new JSDOM("", { url: "https://example.com/" }).window;

const DOCUMENT = OPAQUE_WINDOW.document;

/** `localStorage` where the document has an origin. */
const ORIGIN_STORAGE = storageProbes({
  read: () => ORIGIN_WINDOW.localStorage,
  receiver: "localStorage",
  suffix: "",
});

/**
 * `localStorage` in an opaque-origin document, where the spec throws a
 * `SecurityError`, as a sandboxed iframe does.
 */
const OPAQUE_STORAGE = storageProbes({
  read: () => OPAQUE_WINDOW.localStorage,
  receiver: "localStorage",
  suffix: " (opaque origin)",
});

/**
 * Read a boolean attribute back: the HTML spec counts any value, even
 * `"false"`, as present.
 */
function readBooleanAttribute(text: string): HTMLElement["hidden"] {
  const element = DOCUMENT.createElement("div");
  element.setAttribute("hidden", text);

  return element.hidden;
}

/**
 * Parse with the spec's rules for floating-point numbers, through a number
 * input; a value they reject sanitizes to `""`, and reads back as `NaN`.
 */
function readNumberInput(text: string): number {
  const element = DOCUMENT.createElement("input");
  element.type = "number";
  element.value = text;

  return element.valueAsNumber;
}

/**
 * The HTML spec's microsyntaxes, as jsdom implements them.
 *
 * - Integers go through jsdom's own "rules for parsing integers", which
 *   return `null` for a rejected value; reading a reflected attribute such as
 *   `ol.start` instead would show its default, which looks like a parse.
 */
export const HTML: Tool = {
  functions: {
    safeParseBoolean: [
      {
        accepts: isString,
        call: 'div.setAttribute("hidden", value); div.hidden',
        run: ([value]) => readBooleanAttribute(value as string),
      },
    ],
    safeParseInt: [
      {
        accepts: isString,
        call: "parseInteger(value)",
        run: ([value]) => parseInteger(value as string),
      },
    ],
    safeParseNumber: [
      {
        accepts: isString,
        call: "input.value = value; input.valueAsNumber",
        run: ([value]) => readNumberInput(value as string),
      },
    ],
    safeParseUrl: [
      {
        call: "new URL(value, base).href",
        run: ([value, base]) =>
          new ORIGIN_WINDOW.URL(value as string, base as string | undefined)
            .href,
      },
    ],
    safeStorageGetItem: [
      ...ORIGIN_STORAGE.safeStorageGetItem,
      ...OPAQUE_STORAGE.safeStorageGetItem,
    ],
    safeStorageRemoveItem: [
      ...ORIGIN_STORAGE.safeStorageRemoveItem,
      ...OPAQUE_STORAGE.safeStorageRemoveItem,
    ],
    safeStorageSetItem: [
      ...ORIGIN_STORAGE.safeStorageSetItem,
      ...OPAQUE_STORAGE.safeStorageSetItem,
    ],
  },
  name: "HTML (jsdom)",
  tier: 3,
  version: `jsdom ${packageVersion("jsdom")}`,
};
