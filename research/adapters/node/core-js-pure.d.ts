/** core-js-pure's `Iterator.range` entry, which ships untyped. */
declare module "core-js-pure/full/iterator/range.js" {
  /**
   * Build the proposal's numeric or bigint range iterator.
   *
   * @returns an iterator over the range.
   */
  export default function range(
    start: unknown,
    end: unknown,
    option?: unknown
  ): Iterable<unknown>;
}
