/*
 * The AssemblyScript probes: one export per call, per parameter type, compiled
 * to Wasm when the image is built and run by `assemblyscript.mts`.
 *
 * - AssemblyScript is statically typed, so a call that takes a string can't
 *   be handed anything else; each export takes exactly one type, and the
 *   driver picks the export that matches a case's value, or reports `n/a`.
 *
 * - A JSON number is an `f64`, AssemblyScript's `number`.
 *
 * - Each export returns what the call really returns, `i32`, `i64`, or `f32`
 *   included, so the bindings decide how the result reaches JavaScript.
 */

/** `value`, for a boolean: proves it crosses the bindings unchanged. */
export function boolIdentity(value: bool): bool {
  return value;
}

/** `bool.parse(value)`. */
export function boolParse(value: string): bool {
  return bool.parse(value);
}

/** `value.toString()`, for a boolean. */
export function boolToString(value: bool): string {
  return value.toString();
}

/** `value.toString().trim()`, for a boolean. */
export function boolToStringTrim(value: bool): string {
  return value.toString().trim();
}

/** `f32.parse(value)`: a single-precision parse. */
export function f32Parse(value: string): f32 {
  return f32.parse(value);
}

/** `value`, for a number: proves it crosses the bindings unchanged. */
export function f64Identity(value: f64): f64 {
  return value;
}

/** `parseFloat(value)`, the global, as in JavaScript. */
export function f64ParseFloat(value: string): f64 {
  return parseFloat(value);
}

/** `parseInt(value, 10)`, the global, as in JavaScript. */
export function f64ParseInt(value: string): f64 {
  return parseInt(value, 10);
}

/** `value.toString()`, for a number. */
export function f64ToString(value: f64): string {
  return value.toString();
}

/** `value.toString().trim()`, for a number. */
export function f64ToStringTrim(value: f64): string {
  return value.toString().trim();
}

/** `i32.parse(value, 10)`: a 32-bit parse. */
export function i32Parse(value: string): i32 {
  return i32.parse(value, 10);
}

/** `i64.parse(value, 10)`: a 64-bit parse, which reaches JS as a bigint. */
export function i64Parse(value: string): i64 {
  return i64.parse(value, 10);
}

/** `value`, for a string: proves it crosses the bindings unchanged. */
export function stringIdentity(value: string): string {
  return value;
}

/** `value.trim()`: `toString()` on a string returns the string itself. */
export function stringTrim(value: string): string {
  return value.trim();
}
