import { describe, expect, test } from "vitest";

import { CROSS_ENV_CASES } from "#test/cross-env.cases";

describe("cross-environment table", () => {
  test.each(CROSS_ENV_CASES)("$description", ({ expected, run }) => {
    // When
    const actual = run();

    // Then
    expect(actual).toStrictEqual(expected);
  });
});
