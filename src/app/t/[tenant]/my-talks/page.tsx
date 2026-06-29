export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantConfig } from "@/lib/tenant-config";
import MyTalksList from "./MyTalksList";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `My talks | ${(await getTenantConfig()).communityName}`,
    description: "View and manage your speaker submissions.",
  };
}

export default async function MyTalksPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login?redirect_url=/my-talks"));
  }
  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <main className="max-w-4xl mx-auto px-6 py-10">
        <MyTalksList />
      </main>
    </div>
  );
}
