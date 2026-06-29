import { beforeAll, describe, expect, it } from "vitest";
import { signSlideRenderUrl, verifySlideRenderSig } from "@/lib/slideRenderSign";

// The signed render URL is the ONLY credential the public /internal/slide-render
// page has (it's selfTenanted — no Clerk session, no middleware tenant header).
// B7 binds the tenant into the HMAC payload so a signature minted for one
// tenant's slide can't be replayed to render another tenant's slide. tsc can't
// see this — it's an HMAC property.
beforeAll(() => {
  process.env.RENDER_SIGNING_SECRET = "test-secret-at-least-16-chars-long";
});

const base = { eventId: "e1", slideId: "s1", speakerId: "sp1", refWidth: 800 };

describe("slide-render signature binds the tenant", () => {
  it("verifies with the SAME tenant + ids it was signed for", async () => {
    const { exp, sig } = await signSlideRenderUrl({ tenant: "au", ...base });
    expect(await verifySlideRenderSig({ tenant: "au", ...base, exp, sig })).toBe(true);
  });

  it("REJECTS the signature replayed against another tenant (identical ids)", async () => {
    const { exp, sig } = await signSlideRenderUrl({ tenant: "au", ...base });
    // Same eventId/slideId/speakerId, different tenant → must fail.
    expect(await verifySlideRenderSig({ tenant: "acme", ...base, exp, sig })).toBe(false);
  });

  it("rejects a tampered slide id (HMAC integrity)", async () => {
    const { exp, sig } = await signSlideRenderUrl({ tenant: "au", ...base });
    expect(await verifySlideRenderSig({ tenant: "au", ...base, slideId: "s2", exp, sig })).toBe(false);
  });

  it("rejects an expired signature", async () => {
    const { sig } = await signSlideRenderUrl({ tenant: "au", ...base });
    expect(await verifySlideRenderSig({ tenant: "au", ...base, exp: 1, sig })).toBe(false);
  });
});
