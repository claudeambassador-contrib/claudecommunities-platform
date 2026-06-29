import type { ReactNode } from "react";
import { getTenantId } from "@/lib/tenant-context";

/**
 * Tenant route subtree. Every per-community page/route lives under here; the
 * middleware rewrites `/<slug>/…` (or a custom domain) to `/t/<slug>/…` and
 * stamps the trusted `x-tenant-id` header that `getTenantId()` reads.
 *
 * Defense in depth: the rewrite path param and the header both derive from the
 * SAME validated resolution, so a mismatch should be impossible — if it ever
 * happens we fail closed rather than render the wrong tenant.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const resolved = await getTenantId();
  if (tenant !== resolved) {
    throw new Error(`Tenant mismatch: path "${tenant}" vs header "${resolved}"`);
  }
  return children;
}
