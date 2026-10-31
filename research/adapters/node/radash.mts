import {
  assign,
  isEmpty,
  isEqual,
  isObject,
  list,
  objectify,
  toFloat,
  toInt,
} from "radash";

import type { Tool } from "./tool.mts";

import {
  isPair,
  isRangeCase,
  keyGetter,
  markClone,
  markKeyed,
  packageVersion,
  rangeArguments,
  readRangeSpan,
} from "./tool.mts";

/** radash, whose `toInt` and `toFloat` return a fallback instead of `NaN`. */
export const RADASH: Tool = {
  functions: {
    deepMerge: [
      {
        accepts: isPair,
        call: "assign(defaults, overrides)",
        run: ([defaults, overrides]) =>
          markClone({
            clone: assign(
              defaults as Record<string, unknown>,
              overrides as Record<string, unknown>
            ),
            source: [defaults, overrides],
          }),
      },
    ],
    isDeepEqual: [
      {
        accepts: isPair,
        call: "isEqual(a, b)",
        run: ([a, b]) => isEqual(a, b),
      },
    ],
    // radash's `isObject` checks `constructor === Object`: a plain-object test.
    isPlainObject: [
      { call: "isObject(value)", run: ([value]) => isObject(value) },
    ],
    isSafeEmpty: [{ call: "isEmpty(value)", run: ([value]) => isEmpty(value) }],
    keyBy: [
      {
        accepts: isPair,
        call: "objectify(items, getKey)",
        run: ([items, key]) =>
          markKeyed(
            objectify(
              items as readonly unknown[],
              keyGetter(key) as (item: unknown) => PropertyKey
            )
          ),
      },
    ],
    range: [
      {
        accepts: isRadashRange,
        call: "list(start, end, undefined, step)",
        run: (args) => {
          const [start, end, step] = rangeArguments(args);

          return list(
            start as number,
            end as number,
            undefined,
            step as number | undefined
          );
        },
      },
    ],
    safeParseInt: [{ call: "toInt(value)", run: ([value]) => toInt(value) }],
    safeParseNumber: [
      { call: "toFloat(value)", run: ([value]) => toFloat(value) },
    ],
  },
  name: "radash",
  tier: 1,
  version: packageVersion("radash"),
};

/**
 * The gap between a positive float and the next one up, for a normal float.
 *
 * - `Math.log2` can round up just below a power of two (it gives `53` for
 *   2^53 - 1), so the exponent is corrected against the power itself.
 *
 * @returns the spacing, which underflows to `0` for the smallest floats.
 */
function floatSpacing(magnitude: number): number {
  if (magnitude === 0) {
    return 0;
  }

  const roundedExponent = Math.floor(Math.log2(magnitude));
  const exponent =
    2 ** roundedExponent > magnitude ? roundedExponent - 1 : roundedExponent;

  return 2 ** (exponent - 52);
}

/**
 * Whether radash's `list` can run a `range` case without looping forever.
 *
 * - `list` steps until it passes `end`, so a zero or negative step never
 *   stops, nor does a step too small to change the value; a long span
 *   builds every item. All three are `n/a`.
 *
 * @returns whether the probe can run the case.
 */
function isRadashRange(args: readonly unknown[]): boolean {
  if (
    !isRangeCase({
      args,
      hasEndForm: true,
      hasOptionsParameter: false,
      optionKeys: ["step"],
      shouldBoundEveryCount: true,
    })
  ) {
    return false;
  }

  const span = readRangeSpan(args);

  if (span === undefined) {
    return false;
  }

  const { end, start, step } = span;
  const largest = Math.max(Math.abs(start), Math.abs(end));

  // `i += step` can stop moving once `step` is under the spacing of floats
  // at the range's magnitude, as at 2^53 with a step of 1.
  return step > 0 && step >= floatSpacing(largest);
}
