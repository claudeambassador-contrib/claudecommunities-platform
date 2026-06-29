import { redirect } from "next/navigation";

// The console landing currently has a single section — tenants.
export default function PlatformAdminIndex() {
  redirect("/admin/tenants");
}
