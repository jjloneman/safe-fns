import { describe, expectTypeOf, test } from "vitest";

import type { isPlaceholder } from "./is-placeholder";

describe("isPlaceholder", () => {
  test("is typed as the literal true", () => {
    // Given/When/Then
    expectTypeOf<typeof isPlaceholder>().toEqualTypeOf<true>();
  });
});
