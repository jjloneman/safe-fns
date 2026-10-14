/*
 * jsdom's string helpers, which ship untyped; `html.mts` imports one.
 *
 * - jsdom has no `exports` map, so its internals resolve by path.
 */
declare module "jsdom/lib/jsdom/living/helpers/strings.js" {
  /**
   * The HTML spec's "rules for parsing integers".
   *
   * @returns the integer, or `null` for a value the rules reject.
   */
  export function parseInteger(input: string): null | number;
}
