import { ArrowRight, PlayCircle, Video } from "lucide-react";
import type { Metadata } from "next";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { VIDEO_RESOURCES, youtubeThumbnail } from "@/lib/resources";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
  const { communityName, countryName } = await getTenantConfig();

  const BASE_URL = await siteUrl();
  const PAGE_URL = `${BASE_URL}/resources`;

  const TITLE = `Resources | ${communityName}`;
  const DESCRIPTION = `Free videos, walkthroughs, and tutorials from Claude Code builders across ${countryName}. Learn workflows, patterns, and tips for shipping AI-powered apps.`;

  return {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
      "Claude Code resources",
      "Claude Code tutorials",
      "Claude Code videos",
      "Claude AI workflows",
      `Claude Code ${countryName}`,
    ],
    alternates: {
      canonical: PAGE_URL,
    },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: PAGE_URL,
      type: "website",
      siteName: communityName,
      locale: await ogLocale(),
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default async function ResourcesPage() {
  const { nationality } = await getTenantConfig();

  return (
    <main className="bg-[#1C1917] min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#D4836A]" />
            <span className="text-[#D4836A] text-xs font-semibold uppercase tracking-wider">
              Resources
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-[#FAF9F6] leading-[1.1] mb-5">
            Build with Claude Code, faster.
          </h1>
          <p className="text-[#A8A29E] text-lg max-w-[700px] leading-relaxed">
            Videos, walkthroughs, and workflows from builders in the {nationality} Claude Code
            community. Free for community members.
          </p>
        </div>

        {/* Videos grid */}
        {VIDEO_RESOURCES.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#78716C] mb-6 flex items-center gap-2">
              <Video className="w-4 h-4" />
              Videos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {VIDEO_RESOURCES.map((r) => (
                <TenantLink
                  key={r.slug}
                  href={`/resources/${r.slug}`}
                  className="group bg-[#2D2926] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-[#D4836A]/40 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(212,131,106,0.12)] transition-all duration-300 flex flex-col"
                >
                  <div className="relative aspect-video bg-[#1C1917] overflow-hidden">
                    <RemoteImage
                      src={youtubeThumbnail(r.youtubeId)}
                      alt={r.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-[#D4836A]/95 flex items-center justify-center shadow-[0_8px_30px_rgba(212,131,106,0.4)] group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-8 h-8 text-[#1C1917]" />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {r.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-1 rounded-full text-[0.7rem] font-medium bg-[#D4836A]/15 text-[#D4836A] uppercase tracking-wider"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-xl font-semibold text-[#FAF9F6] group-hover:text-[#D4836A] transition-colors mb-2 leading-snug">
                      {r.title}
                    </h3>
                    <p className="text-[#A8A29E] text-[0.9375rem] leading-relaxed line-clamp-3 mb-5 flex-1">
                      {r.summary}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {r.speakers[0] && (
                          <>
                            <RemoteImage
                              src={r.speakers[0].photo}
                              alt={r.speakers[0].name}
                              className="w-7 h-7 rounded-full object-cover"
                              style={{ objectPosition: r.speakers[0].photoPosition }}
                            />
                            <span className="text-[#D6D3D1]">{r.speakers[0].name}</span>
                          </>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[#A8A29E] group-hover:text-[#D4836A] font-medium transition-colors">
                        Watch
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </TenantLink>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-[#A8A29E]">New videos are on the way — check back soon.</p>
        )}

        {/* CTA */}
        <section className="mt-20">
          <div className="bg-gradient-to-br from-[#D4836A] to-[#C97658] rounded-3xl p-10 md:p-12 text-[#1C1917] flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">
                Got a workflow worth sharing?
              </h2>
              <p className="text-[#1C1917]/80 leading-relaxed max-w-[520px]">
                We&apos;re always looking for community members to share what they&apos;re building
                with Claude Code. Pitch a talk or a video and we&apos;ll help you get it in front of
                the community.
              </p>
            </div>
            <TenantLink
              href="/speak"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#1C1917] text-[#FAF9F6] font-semibold hover:bg-[#292524] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap"
            >
              Become a Speaker
              <ArrowRight className="w-4 h-4" />
            </TenantLink>
          </div>
        </section>
      </div>
    </main>
  );
}
