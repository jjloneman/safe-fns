import { describe, expect, test } from "vitest";

import { isPlaceholder } from "./index";

describe("index", () => {
  test("exports the placeholder", () => {
    // Given/When/Then
    expect(isPlaceholder).toBe(true);
  });
});
