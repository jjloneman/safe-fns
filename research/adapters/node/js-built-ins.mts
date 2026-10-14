import type { Tool } from "./tool.mts";

/**
 * The runtime's own globals, versioned by the Node release; `JSON.parse` is
 * the JSON column's.
 */
export const JS_BUILT_INS: Tool = {
  functions: {
    codec: [{ call: "value", run: ([value]) => value }],
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
  },
  name: "JS built-ins",
  tier: 1,
  version: process.version,
};
