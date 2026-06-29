import { describe, expect, it } from "vitest";
import { parseContentSections } from "@/lib/cms/page";

/**
 * Guards the two correctness traps for tenant content pages:
 *  1. an empty/absent/malformed page parses to `[]` — NEVER the home default
 *     (a content page must not silently render the home layout);
 *  2. the palette is richText-only — other block types are dropped on read.
 */
describe("parseContentSections", () => {
  it("returns [] for empty / missing / malformed input (never the home default)", () => {
    expect(parseContentSections(null)).toEqual([]);
    expect(parseContentSections(undefined)).toEqual([]);
    expect(parseContentSections("")).toEqual([]);
    expect(parseContentSections("not json")).toEqual([]);
    expect(parseContentSections(JSON.stringify({ blocks: [] }))).toEqual([]);
    expect(parseContentSections(JSON.stringify({ nope: 1 }))).toEqual([]);
  });

  it("keeps valid richText blocks (accepts both {blocks:[]} and bare [])", () => {
    const block = { id: "a", type: "richText", enabled: true, heading: "Hi", body: "Body" };
    expect(parseContentSections(JSON.stringify({ blocks: [block] }))).toEqual([block]);
    expect(parseContentSections(JSON.stringify([block]))).toEqual([block]);
  });

  it("normalises a missing heading to null and preserves enabled=false", () => {
    const raw = JSON.stringify({ blocks: [{ id: "a", type: "richText", enabled: false, body: "B" }] });
    expect(parseContentSections(raw)).toEqual([
      { id: "a", type: "richText", enabled: false, heading: null, body: "B" },
    ]);
  });

  it("drops non-richText blocks and malformed richText blocks", () => {
    const raw = JSON.stringify({
      blocks: [
        { id: "h", type: "hero", enabled: true, heading: "x" },
        { id: "b", type: "richText", enabled: true, body: 42 },
        { id: "ok", type: "richText", enabled: true, body: "keep" },
      ],
    });
    expect(parseContentSections(raw)).toEqual([
      { id: "ok", type: "richText", enabled: true, heading: null, body: "keep" },
    ]);
  });
});
