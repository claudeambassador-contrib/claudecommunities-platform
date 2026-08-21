import { describe, expect, it } from "vitest";

import { formatTimeAgo } from "@/shared/ui/timeAgo";

const NOW = Date.parse("2026-08-19T12:00:00.000Z");

function isoBefore(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe(formatTimeAgo, () => {
  it("returns 'just now' under a minute", () => {
    expect(formatTimeAgo(isoBefore(0), NOW)).toBe("just now");
    expect(formatTimeAgo(isoBefore(59_000), NOW)).toBe("just now");
  });

  it("clamps future timestamps to 'just now'", () => {
    expect(formatTimeAgo(isoBefore(-120_000), NOW)).toBe("just now");
  });

  it("returns minutes under an hour", () => {
    expect(formatTimeAgo(isoBefore(60_000), NOW)).toBe("1m ago");
    expect(formatTimeAgo(isoBefore(59 * 60_000 + 59_000), NOW)).toBe("59m ago");
  });

  it("returns hours under a day", () => {
    expect(formatTimeAgo(isoBefore(60 * 60_000), NOW)).toBe("1h ago");
    expect(formatTimeAgo(isoBefore(23 * 60 * 60_000), NOW)).toBe("23h ago");
  });

  it("returns days under a week", () => {
    expect(formatTimeAgo(isoBefore(24 * 60 * 60_000), NOW)).toBe("1d ago");
    expect(formatTimeAgo(isoBefore(6 * 24 * 60 * 60_000), NOW)).toBe("6d ago");
  });

  it("returns a locale date at 7 days or more", () => {
    const iso = isoBefore(7 * 24 * 60 * 60_000);
    expect(formatTimeAgo(iso, NOW)).toBe(new Date(iso).toLocaleDateString());
  });
});
