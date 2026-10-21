import Ajv from "ajv";

import type { Probe, Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** The JSON Schema types the probes coerce to. */
const SCHEMA_TYPES = ["boolean", "integer", "number", "string"] as const;

/** A value to coerce, and the JSON Schema type to coerce it to. */
type CoerceInput = {
  /**
   * The JSON Schema type to coerce to.
   *
   * @example "boolean"
   */
  type: SchemaType;

  /**
   * The case's value.
   *
   * @example "true"
   */
  value: unknown;
};

/** The JSON Schema type keyword each function's probe validates against. */
type SchemaType = (typeof SCHEMA_TYPES)[number];

const AJV = new Ajv({ coerceTypes: true });

// Compiled once: Ajv caches by schema object, so a fresh schema per case
// would compile again and grow its cache on every call.
const VALIDATORS = new Map(
  SCHEMA_TYPES.map((type) => [
    type,
    AJV.compile<{ v: unknown }>({
      properties: { v: { type } },
      type: "object",
    }),
  ])
);

/**
 * Coerce a value through Ajv, the way it rewrites a property in place.
 *
 * - Ajv only coerces a value inside its parent, so the case is wrapped in
 *   `{ v }` and read back out.
 *
 * - An invalid value is reported, not thrown, so this throws Ajv's own
 *   `ValidationError` to record it as an error; the call text names the
 *   `coerce` wrapper.
 *
 * @returns the coerced value.
 */
function coerce({ type, value }: CoerceInput): unknown {
  const validate = VALIDATORS.get(type);
  const data = { v: value };

  if (validate !== undefined && !validate(data)) {
    throw new Ajv.ValidationError(validate.errors ?? []);
  }

  return data.v;
}

/** The probe that coerces to one JSON Schema type. */
function coerceProbe(type: SchemaType): Probe {
  return {
    call: `coerce({ type: "${type}" }, value)`,
    run: ([value]) => coerce({ type, value }),
  };
}

/** JSON Schema's type coercion, through Ajv's `coerceTypes`. */
export const AJV_COERCE: Tool = {
  functions: {
    safeParseBoolean: [coerceProbe("boolean")],
    safeParseInt: [coerceProbe("integer")],
    safeParseNumber: [coerceProbe("number")],
    safeParseString: [coerceProbe("string")],
  },
  name: "Ajv",
  tier: 4,
  version: packageVersion("ajv"),
};
