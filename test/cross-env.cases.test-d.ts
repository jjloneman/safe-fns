/*
 * Type tests for `defineCrossEnvCase`, which checks each row against its
 * function before erasing the row's types.
 *
 * - A regression in its generics would let a mistyped row into the table with
 *   no error, so the rejection itself is what's under test.
 */

import { describe, expectTypeOf, test } from "vitest";

import { defineCrossEnvCase } from "#test/cross-env.cases";

describe("defineCrossEnvCase", () => {
  test("rejects an expected value the function can't return", () => {
    // Given
    const countCharacters = (text: string): number => text.length;

    // Then
    defineCrossEnvCase({
      description: "wrong expected type",
      // @ts-expect-error — `countCharacters` returns a number, not a string.
      expected: "3",
      fn: countCharacters,
      input: "abc",
    });
  });

  test("rejects an input the function can't take", () => {
    // Given
    const countCharacters = (text: string): number => text.length;

    // Then
    defineCrossEnvCase({
      description: "wrong input type",
      expected: 3,
      fn: countCharacters,
      // @ts-expect-error — `countCharacters` takes a string, not a number.
      input: 123,
    });
  });

  test("erases the row's types so one table holds any function", () => {
    // Given
    const countCharacters = (text: string): number => text.length;

    // When
    const crossEnvCase = defineCrossEnvCase({
      description: "counts characters",
      expected: 3,
      fn: countCharacters,
      input: "abc",
    });

    // Then
    expectTypeOf(crossEnvCase.run).returns.toBeUnknown();
  });
});
