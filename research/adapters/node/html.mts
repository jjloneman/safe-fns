import { JSDOM } from "jsdom";
import { parseInteger } from "jsdom/lib/jsdom/living/helpers/strings.js";

import type { Tool } from "./tool.mts";

import { isString, packageVersion } from "./tool.mts";

const DOCUMENT = new JSDOM("").window.document;

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
    safeParseInteger: [
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
  },
  name: "HTML (jsdom)",
  tier: 3,
  version: `jsdom ${packageVersion("jsdom")}`,
};
