import { describe, expect, it } from "vitest";

import { first, iso } from "@/shared/db/rows";

describe("rows helpers", () => {
  it("first returns the head or undefined", () => {
    expect(first([1, 2])).toBe(1);
    expect(first([])).toBeUndefined();
  });

  it("iso formats a Date and passes null through", () => {
    expect(iso(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
    expect(iso(null)).toBeNull();
    expect(iso()).toBeNull();
  });
});
