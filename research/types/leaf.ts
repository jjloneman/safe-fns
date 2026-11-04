/*
 * What the planned deep type helpers keep whole, shared among them as the
 * package's `src/internal/` module will be.
 */

/** Values the helpers keep whole: functions, constructors, and built-ins. */
export type BuiltInLeaf =
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown)
  | ArrayBuffer
  | ArrayBufferView
  | Date
  | Error
  | Promise<unknown>
  | ReadonlyMap<unknown, unknown>
  | ReadonlySet<unknown>
  | RegExp
  | WeakMap<object, unknown>
  | WeakSet<object>;

/** Every primitive type, kept as it is. */
export type Primitive =
  bigint | boolean | null | number | string | symbol | undefined;
