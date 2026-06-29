import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";
import ShopifyCollection from "./ShopifyCollection";

export async function generateMetadata(): Promise<Metadata> {
  const { communityName } = await getTenantConfig();
  const SITE_URL = await siteUrl();
  return {
    title: `Merch Store | ${communityName}`,
    description: `Shop official ${communityName} shirts.`,
    openGraph: {
      title: `Merch Store | ${communityName}`,
      description: `Shop official ${communityName} merch.`,
      url: `${SITE_URL}/merch`,
    },
    alternates: {
      canonical: `${SITE_URL}/merch`,
    },
  };
}

export default async function MerchPage() {
  const { merchEnabled } = await getTenantConfig();
  if (!merchEnabled) notFound();
  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4836A]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-12 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A]/10 rounded-full text-[#D4836A] text-sm font-medium mb-6">
              <ShoppingBag className="w-4 h-4" />
              Official Merch
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Merch Store
            </h1>
            <p className="text-lg text-[#A8A29E] max-w-xl mx-auto leading-relaxed">
              Rep the community. Browse our collection of shirts.
            </p>
          </div>
        </div>
      </div>

      {/* Shopify Collection */}
      <div className="max-w-[1200px] mx-auto px-6 pb-24">
        <ShopifyCollection />
      </div>
    </div>
  );
}
