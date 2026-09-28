import { describe, expect, test } from "vitest";

import { isPlaceholder } from "./is-placeholder";

describe("isPlaceholder", () => {
  test("is true", () => {
    // Given/When/Then
    expect(isPlaceholder).toBe(true);
  });
});
