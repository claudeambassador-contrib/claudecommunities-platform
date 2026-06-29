/**
 * HMAC-signed URL helpers for `/admin/slides/render/...`.
 *
 * The render page is reached over the public internet by Cloudflare Browser
 * Rendering (puppeteer.connect → fresh browser context, no cookies). Rather
 * than minting a Clerk session for puppeteer, we sign a short-lived URL on
 * the server, hand it to puppeteer, and have the page reject anything
 * without a valid signature.
 *
 * Signature input is `${tenant}|${eventId}|${slideId}|${speakerId}|${refWidth}|${exp}`.
 * `tenant` BINDS the signed URL to the slide's tenant — the selfTenanted render
 * page re-establishes that exact tenant scope (`runWithTenant`) for its data
 * reads, so a signature can't be used to render another tenant's slide. Keep
 * `exp` short (the renderer should consume the URL within a few seconds).
 */

const ENC = new TextEncoder();

function getSecret(): string {
  const secret = process.env.RENDER_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("RENDER_SIGNING_SECRET is not set (need a 16+ char random string)");
  }
  return secret;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

function payload(
  tenant: string,
  eventId: string,
  slideId: string,
  speakerId: string,
  refWidth: number,
  exp: number,
): string {
  return `${tenant}|${eventId}|${slideId}|${speakerId}|${refWidth}|${exp}`;
}

export interface SlideRenderSig {
  exp: number; // unix seconds
  sig: string; // hex HMAC-SHA256
}

export async function signSlideRenderUrl(args: {
  tenant: string;
  eventId: string;
  slideId: string;
  speakerId: string;
  refWidth: number;
  ttlSeconds?: number;
}): Promise<SlideRenderSig> {
  const ttl = args.ttlSeconds ?? 60;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = await hmacSha256Hex(
    getSecret(),
    payload(args.tenant, args.eventId, args.slideId, args.speakerId, args.refWidth, exp),
  );
  return { exp, sig };
}

export async function verifySlideRenderSig(args: {
  tenant: string;
  eventId: string;
  slideId: string;
  speakerId: string;
  refWidth: number;
  exp: number;
  sig: string;
}): Promise<boolean> {
  if (!Number.isFinite(args.exp) || args.exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacSha256Hex(
    getSecret(),
    payload(args.tenant, args.eventId, args.slideId, args.speakerId, args.refWidth, args.exp),
  );
  return timingSafeEqualHex(expected, args.sig);
}
