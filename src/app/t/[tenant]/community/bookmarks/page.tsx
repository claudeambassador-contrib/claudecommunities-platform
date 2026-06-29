export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import BookmarksClient from "./BookmarksClient";

export const metadata = {
  title: "Bookmarks - Claude Code Meetups",
};

export default async function BookmarksPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/api/auth/signin"));
  }

  const userId = user.id;
  const userName = user?.name || "User";

  return <BookmarksClient userId={userId} userName={userName} />;
}
