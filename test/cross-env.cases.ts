/**
 * One row of the cross-environment table: a call and the result every runtime
 * must agree on.
 */
export type CrossEnvCase = {
  /** Names the test, so a failing row reads without printing its values. */
  description: string;

  /** The result the call must return, compared with `toStrictEqual`. */
  expected: unknown;

  /** Makes the call under test. */
  run: () => unknown;
};

/**
 * Build a {@link CrossEnvCase}, checking that `input` fits `fn` and that
 * `expected` fits its return type.
 *
 * @returns the row, with the call deferred to `run`.
 */
export function defineCrossEnvCase<Input, Output>({
  description,
  expected,
  fn,
  input,
}: {
  /** Names the test. */
  description: string;

  /** The result `fn(input)` must return in every environment. */
  expected: NoInfer<Output>;

  /** The function under test. */
  fn: (input: Input) => Output;

  /** The value passed to `fn`. */
  input: NoInfer<Input>;
}): CrossEnvCase {
  return { description, expected, run: () => fn(input) };
}

const describeType = (value: unknown): string => typeof value;

/**
 * Every row here runs unchanged in each test project, so a function's
 * environment-independence is checked rather than assumed.
 *
 * - Rows must stay environment-neutral: no `node:*` imports and no DOM
 *   globals, or the projects stop testing the same thing.
 *
 * - Seeded with rows for the built-in `typeof` until the first real function
 *   lands, so the harness is proven before anything depends on it.
 */
export const crossEnvCases: readonly CrossEnvCase[] = [
  defineCrossEnvCase({
    description: "typeof 1n is bigint",
    expected: "bigint",
    fn: describeType,
    input: 1n,
  }),
  defineCrossEnvCase({
    description: "typeof null is object",
    expected: "object",
    fn: describeType,
    input: null,
  }),
  defineCrossEnvCase({
    description: "typeof a symbol is symbol",
    expected: "symbol",
    fn: describeType,
    input: Symbol("cross-env"),
  }),
];
