import { describe, expectTypeOf, test } from "vitest";

import type { isPlaceholder } from "./index";

describe("index", () => {
  test("types the placeholder as the literal true", () => {
    // Given/When/Then
    expectTypeOf<typeof isPlaceholder>().toEqualTypeOf<true>();
  });
});
