export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantConfig } from "@/lib/tenant-config";
import TalkEditor from "./TalkEditor";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Edit talk | ${(await getTenantConfig()).communityName}`,
  };
}

export default async function MyTalkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login?redirect_url=/my-talks"));
  }
  const { id } = await params;
  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <main className="max-w-3xl mx-auto px-6 py-10">
        <TalkEditor talkId={id} />
      </main>
    </div>
  );
}
