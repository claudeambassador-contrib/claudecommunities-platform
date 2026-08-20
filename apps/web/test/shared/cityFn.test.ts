import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// cityFn pulls in guarded → cityPage → the cloudflare:workers env chain, which
// vitest can't load. The schema merge under test needs none of it.
vi.mock("@/shared/http/cityPage", () => ({ loadCityPage: vi.fn() }));

import { cityInput } from "@/shared/http/cityFn";

describe("cityInput", () => {
  it("requires citySlug when the route declares no extra input", () => {
    const schema = cityInput();
    expect(schema.parse({ citySlug: "sydney" })).toEqual({ citySlug: "sydney" });
    expect(() => schema.parse({})).toThrow(z.ZodError);
  });

  it("rejects an empty citySlug", () => {
    expect(() => cityInput().parse({ citySlug: "" })).toThrow(z.ZodError);
  });

  it("merges the route's input shape on top of citySlug", () => {
    const schema = cityInput({ name: z.string(), price: z.number() });
    expect(schema.parse({ citySlug: "sydney", name: "Gold", price: 10 })).toEqual({
      citySlug: "sydney",
      name: "Gold",
      price: 10,
    });
  });

  it("makes the extra input fields required", () => {
    const schema = cityInput({ name: z.string() });
    expect(() => schema.parse({ citySlug: "sydney" })).toThrow(z.ZodError);
  });

  it("still requires citySlug when extra input is given", () => {
    const schema = cityInput({ name: z.string() });
    expect(() => schema.parse({ name: "Gold" })).toThrow(z.ZodError);
  });

  it("throws ZodError on a wrongly-typed extra field", () => {
    const schema = cityInput({ price: z.number() });
    expect(() => schema.parse({ citySlug: "sydney", price: "ten" })).toThrow(z.ZodError);
  });

  it("keeps optional and nullable extra fields optional/nullable", () => {
    const schema = cityInput({
      note: z.string().optional(),
      yearlyPrice: z.number().nullable(),
    });
    expect(schema.parse({ citySlug: "sydney", yearlyPrice: null })).toEqual({
      citySlug: "sydney",
      yearlyPrice: null,
    });
  });

  it("does not let a route override citySlug's own validation away", () => {
    // citySlug is spread first, so a route shape could shadow it — assert the
    // default (no shadowing) still applies the min(1) rule.
    const schema = cityInput({ name: z.string() });
    expect(() => schema.parse({ citySlug: "", name: "Gold" })).toThrow(z.ZodError);
  });

  it("does not let a route's own citySlug field shadow the min(1) rule", () => {
    // A route shape that itself declares a permissive `citySlug` must not
    // win over the module's own min(1) rule — the module's citySlug wins.
    const schema = cityInput({ citySlug: z.string(), name: z.string() });
    expect(() => schema.parse({ citySlug: "", name: "Gold" })).toThrow(z.ZodError);
  });
});
