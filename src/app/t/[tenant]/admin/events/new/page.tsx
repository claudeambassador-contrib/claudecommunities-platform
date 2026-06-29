import { redirect } from "next/navigation";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function NewEventPage() {
  // Redirect to main events page - event creation is handled via modal there
  redirect(tenantHref(await getTenantBase(), "/admin/events?create=true"));
}
