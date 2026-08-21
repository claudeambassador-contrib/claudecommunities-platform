import { createHmac, timingSafeEqual } from "node:crypto";

const WHSEC_PREFIX = /^whsec_/;

import { eq } from "drizzle-orm";

import { unsubscribeByEmail } from "@/modules/identity/services/usersService";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

export function emailSigningSecret(env: Record<string, unknown>): string | null {
  const secret = String(env.RENDER_SIGNING_SECRET ?? env.RESEND_API_KEY ?? "").trim();
  return secret || null;
}

export function signUnsubscribeToken(email: string, secret: string): string {
  const normalized = email.trim().toLowerCase();
  const payload = Buffer.from(normalized, "utf-8").toString("base64url");
  const sig = createHmac("sha256", secret).update(normalized).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [payload, sig] = token.split(".");
  if (!(payload && sig)) {
    return null;
  }
  let email: string;
  try {
    email = Buffer.from(payload, "base64url").toString("utf-8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email.includes("@")) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(email).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  return email;
}

export function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignatureHeader: string,
  secret: string,
): boolean {
  const tsSec = Number(svixTimestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) {
    return false;
  }
  const secretBytes = Buffer.from(secret.replace(WHSEC_PREFIX, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const provided = svixSignatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((sig): sig is string => Boolean(sig));
  return provided.some((sig) => {
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

function statusFromEvent(type: string): string | null {
  if (type === "email.delivered" || type === "delivered") {
    return "delivered";
  }
  if (type === "email.bounced" || type === "bounced") {
    return "bounced";
  }
  if (type === "email.complained" || type === "complained") {
    return "complained";
  }
  return null;
}

export async function applyResendEvent(
  store: TenantStore,
  input: { resendId: string; type: string },
): Promise<Result<{ status?: string; updated: boolean }>> {
  const resendId = input.resendId.trim();
  if (!resendId) {
    return err("bad_request", 400, "resendId is required");
  }
  const status = statusFromEvent(input.type);
  if (!status) {
    return ok({ updated: false });
  }
  const { emailSends } = store.tables;
  const rows = await store.db
    .select()
    .from(emailSends)
    .where(eq(emailSends.externalId, resendId))
    .limit(1);
  const [row] = rows;
  if (!row || row.orgId !== store.orgId) {
    return ok({ updated: false });
  }
  await store.db.update(emailSends).set({ status }).where(eq(emailSends.id, row.id));
  return ok({ status, updated: true });
}

export async function unsubscribeEmail(
  registry: RegistryStore,
  email: string,
): Promise<Result<{ email: string }>> {
  return await unsubscribeByEmail(registry, email);
}
