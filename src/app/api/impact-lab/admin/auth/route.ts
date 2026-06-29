import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { withService } from "@/lib/services/_route";
import { ADMIN_COOKIE, loginAdmin, logoutAdmin } from "@/lib/services/impactLab";

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 12,
};

// Trim so a pasted password with stray whitespace doesn't silently fail.
const Input = z.object({ password: z.string().trim().min(1).max(200) });

export const POST = withService(async (request) => {
  // Tight limit — this is the only thing standing in front of the admin area.
  const limited = rateLimit(request, { limit: 6, windowMs: 60_000, key: "impactlab:admin-auth" });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the admin password." }, { status: 400 });
  }

  const token = await loginAdmin(parsed.data.password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, cookieOpts);
  return res;
});

export const DELETE = withService(async () => {
  await logoutAdmin();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  return res;
});
