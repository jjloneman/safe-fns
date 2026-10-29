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

/** `new Date(i64(value)).toISOString()`, for epoch milliseconds. */
export function f64DateToIsoString(value: f64): string {
  return new Date(i64(value)).toISOString();
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

/** `Date.fromString(value).toISOString()`. */
export function stringDateFromString(value: string): string {
  return Date.fromString(value).toISOString();
}

/** `decodeURI(value)`. */
export function stringDecodeUri(value: string): string {
  return decodeURI(value);
}

/** `decodeURIComponent(value)`. */
export function stringDecodeUriComponent(value: string): string {
  return decodeURIComponent(value);
}

/** `encodeURI(value)`. */
export function stringEncodeUri(value: string): string {
  return encodeURI(value);
}

/** `encodeURIComponent(value)`. */
export function stringEncodeUriComponent(value: string): string {
  return encodeURIComponent(value);
}

/** `value`, for a string: proves it crosses the bindings unchanged. */
export function stringIdentity(value: string): string {
  return value;
}

/** `value.charAt(0).toLowerCase() + value.slice(1)`. */
export function stringLowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/** `value.trim()`: `toString()` on a string returns the string itself. */
export function stringTrim(value: string): string {
  return value.trim();
}

/** `value.charAt(0).toUpperCase() + value.slice(1)`. */
export function stringUpperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
