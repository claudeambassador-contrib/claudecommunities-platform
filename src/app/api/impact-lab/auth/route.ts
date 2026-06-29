import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { withService } from "@/lib/services/_route";
import {
  checkInParticipant,
  SESSION_COOKIE,
  signOutBySessionToken,
  verifyAccessCode,
} from "@/lib/services/impactLab";

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24, // one event day
};

const Input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    code: z.string().min(1).max(64),
  }),
  z.object({
    action: z.literal("check-in"),
    code: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200),
    teamId: z.string().trim().max(60).optional(),
  }),
]);

export const POST = withService(async (request) => {
  const limited = rateLimit(request, { limit: 20, windowMs: 60_000, key: "impactlab:auth" });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in every field." }, { status: 400 });
  }

  if (parsed.data.action === "verify") {
    await verifyAccessCode(parsed.data.code);
    return NextResponse.json({ ok: true });
  }

  const token = await checkInParticipant(parsed.data);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, cookieOpts);
  return res;
});

export const DELETE = withService(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await signOutBySessionToken(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  return res;
});
