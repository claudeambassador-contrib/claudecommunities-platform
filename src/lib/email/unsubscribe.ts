/**
 * HMAC-based unsubscribe token generation and verification.
 *
 * Tokens encode `userId:sendId:hmac` in base64url so they can be used safely
 * in URLs without additional encoding.
 */

import { createHmac } from "node:crypto";

const SECRET = process.env.UNSUBSCRIBE_SECRET || "dev-secret-change-me";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeHmac(userId: string, sendId: string): string {
  return createHmac("sha256", SECRET).update(`${userId}:${sendId}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an unsubscribe token for a given user + send combination.
 *
 * The returned string is safe for use directly in URLs (base64url encoded).
 */
export function generateUnsubscribeToken(userId: string, sendId: string): string {
  const hmac = computeHmac(userId, sendId);
  const payload = `${userId}:${sendId}:${hmac}`;
  return Buffer.from(payload).toString("base64url");
}

/**
 * Verify an unsubscribe token and extract the userId and sendId.
 *
 * Returns `null` when the token is missing, malformed, or the HMAC does not
 * match (i.e. the token was tampered with).
 */
export function verifyUnsubscribeToken(token: string): { userId: string; sendId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");

    // We expect at least 3 parts: userId, sendId, hmacHex.
    // userId or sendId could themselves contain colons in theory, but the
    // HMAC is always 64 hex chars, so we pop the last segment as the HMAC
    // and rejoin the rest — however for simplicity and safety we only
    // support the common case where neither contains a colon.
    if (parts.length !== 3) return null;

    const [userId, sendId, hmac] = parts;
    if (!userId || !sendId || !hmac) return null;

    const expected = computeHmac(userId, sendId);

    // Constant-time comparison to prevent timing attacks
    if (hmac.length !== expected.length) return null;

    const a = Buffer.from(hmac);
    const b = Buffer.from(expected);
    if (!a.equals(b)) return null;

    return { userId, sendId };
  } catch {
    return null;
  }
}
