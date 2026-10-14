import { describe, expect, test } from "vitest";

import { CROSS_REALM_INPUTS } from "#test/cross-realm-inputs";

describe("cross-realm inputs", () => {
  test.each(CROSS_REALM_INPUTS)(
    "$description is not an instance of this realm's Object",
    ({ value }) => {
      // Given/When/Then
      expect(value instanceof Object).toBe(false);
    }
  );
});
