/*
 * The methods AssemblyScript's compiler gives its numbers and booleans, which
 * its editor typings leave out: with `noLib`, `number` and `boolean` have no
 * members at all, so `value.toString()` fails to typecheck while it compiles.
 *
 * - Only the editor and `tsc` read this file; `asc` never sees it.
 *
 * - Each is an `interface`, so ESLint's `consistent-type-definitions` is off
 *   for it: only declaration merging reaches the global types a primitive's
 *   members come from.
 */

/** A `bool`, which `asc` backs with its `Bool` class. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Boolean {
  /** `"true"` or `"false"`. */
  toString(radix?: i32): string;
}

/** An `f32`, `f64`, or integer, which `asc` backs with a numeric class. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Number {
  /** Format the number, as `F64#toString` does for an `f64`. */
  toString(radix?: i32): string;
}
