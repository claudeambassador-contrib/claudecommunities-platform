import { NextResponse } from "next/server";
import { withService } from "@/lib/services/_route";
import { completeConnect } from "@/lib/services/socialAccounts";

/**
 * OAuth redirect target for LinkedIn. The user has already signed in to
 * LinkedIn and approved the scopes; we exchange the `code` for tokens and
 * persist a SocialAccount row per administered page.
 *
 * Errors are surfaced via query params on the settings page so the admin
 * sees what went wrong without a 500 page.
 */
export const GET = withService(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const settingsUrl = new URL("/admin/social/settings", url.origin);

  if (error) {
    settingsUrl.searchParams.set("error", error);
    return NextResponse.redirect(settingsUrl, { status: 302 });
  }
  if (!code || !state) {
    settingsUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(settingsUrl, { status: 302 });
  }

  try {
    const { count } = await completeConnect({ code, state });
    settingsUrl.searchParams.set("connected", String(count));
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    settingsUrl.searchParams.set("error", message);
  }
  return NextResponse.redirect(settingsUrl, { status: 302 });
});
