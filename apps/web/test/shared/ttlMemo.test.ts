import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ttlMemo } from "@/shared/ttlMemo";

describe(ttlMemo, () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a cached value inside the TTL", () => {
    const memo = ttlMemo<number>(60_000);
    memo.set("k", 1);
    vi.advanceTimersByTime(59_000);
    expect(memo.get("k")).toBe(1);
  });

  it("expires after the TTL", () => {
    const memo = ttlMemo<number>(60_000);
    memo.set("k", 1);
    vi.advanceTimersByTime(61_000);
    expect(memo.get("k")).toBeUndefined();
  });

  it("misses unknown keys", () => {
    const memo = ttlMemo<number>(60_000);
    expect(memo.get("nope")).toBeUndefined();
  });

  it("delete removes a cached value", () => {
    const memo = ttlMemo<number>(60_000);
    memo.set("k", 1);
    memo.delete("k");
    expect(memo.get("k")).toBeUndefined();
  });

  it("delete on an unknown key is a no-op", () => {
    const memo = ttlMemo<number>(60_000);
    expect(() => memo.delete("nope")).not.toThrow();
  });
});
