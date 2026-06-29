export const dynamic = "force-dynamic";

import { ArrowRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PLATFORM } from "@/lib/platform";
import { listPublicCommunities, type PublicCommunity } from "@/lib/services/tenants";

export const metadata: Metadata = {
  title: PLATFORM.name,
  description: PLATFORM.description,
  openGraph: {
    title: PLATFORM.name,
    description: PLATFORM.description,
    images: [{ url: PLATFORM.ogImage, width: 1200, height: 630 }],
  },
};

function CommunityCard({ community }: { community: PublicCommunity }) {
  const label = community.communityName || community.name;
  return (
    <Link
      href={`/${community.slug}`}
      className="group flex flex-col rounded-2xl border border-white/[0.06] bg-[#2D2926] overflow-hidden hover:border-[#D4836A]/50 transition-colors"
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-[#3A3531] to-[#1C1917]">
        {community.image ? (
          <Image
            src={community.image}
            alt={label}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#78716C] text-3xl font-semibold">
            {label.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex flex-col flex-1 p-5">
        <h3 className="text-lg font-semibold text-white">{label}</h3>
        {community.countryName && (
          <p className="text-sm text-[#A8A29E] mt-0.5">{community.countryName}</p>
        )}
        <div className="mt-auto pt-4 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 text-[#78716C]">
            <Users className="w-4 h-4" />
            {community.memberCount} member{community.memberCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 text-[#D4836A] font-medium group-hover:gap-2 transition-all">
            Visit <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function PlatformDirectoryPage() {
  const communities = await listPublicCommunities();

  return (
    <div className="max-w-6xl mx-auto px-6">
      <section className="py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{PLATFORM.tagline}</h1>
        <p className="mt-4 text-lg text-[#A8A29E] max-w-2xl mx-auto">{PLATFORM.description}</p>
      </section>

      <section className="pb-8">
        {communities.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-12 text-center text-[#78716C]">
            No communities yet — check back soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((c) => (
              <CommunityCard key={c.slug} community={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
