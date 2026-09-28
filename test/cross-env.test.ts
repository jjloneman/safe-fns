import { describe, expect, test } from "vitest";

import { crossEnvCases } from "#test/cross-env.cases";

describe("cross-environment table", () => {
  test.each(crossEnvCases)("$description", ({ expected, run }) => {
    // When
    const actual = run();

    // Then
    expect(actual).toStrictEqual(expected);
  });
});
