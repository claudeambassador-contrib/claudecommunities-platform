import { ArrowLeft, ArrowRight, Calendar, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscordPromoCard from "@/components/DiscordPromoCard";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getResourceBySlug, youtubeThumbnail } from "@/lib/resources";
import { discordCommunityInvite, getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = getResourceBySlug(slug);
  if (!resource) return {};

  const { communityName, countryName } = await getTenantConfig();
  const BASE_URL = await siteUrl();

  const pageUrl = `${BASE_URL}/resources/${resource.slug}`;
  const thumb = youtubeThumbnail(resource.youtubeId);
  const title = `${resource.title} | ${communityName}`;

  return {
    title,
    description: resource.summary,
    keywords: [...resource.tags, "Claude Code", `Claude Code ${countryName}`],
    alternates: { canonical: pageUrl },
    openGraph: {
      title: resource.title,
      description: resource.summary,
      url: pageUrl,
      type: "video.other",
      siteName: communityName,
      locale: await ogLocale(),
      images: [{ url: thumb, width: 1280, height: 720, alt: resource.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: resource.title,
      description: resource.summary,
      images: [thumb],
    },
  };
}

export default async function ResourcePage({ params }: PageProps) {
  const { slug } = await params;
  const resource = getResourceBySlug(slug);
  if (!resource) notFound();

  const { communityName, countryName, nationality } = await getTenantConfig();
  const BASE_URL = await siteUrl();

  const thumb = youtubeThumbnail(resource.youtubeId);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: resource.title,
    description: resource.summary,
    thumbnailUrl: thumb,
    uploadDate: resource.publishedAt,
    embedUrl: `https://www.youtube.com/embed/${resource.youtubeId}`,
    contentUrl: `https://youtu.be/${resource.youtubeId}`,
    publisher: {
      "@type": "Organization",
      name: communityName,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/images/claude-code-logo.webp`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data built from internal resource fields and serialized with JSON.stringify; no user-controlled HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="bg-[#1C1917] min-h-screen pt-28 pb-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <TenantLink
            href="/resources"
            className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-[#FAF9F6] text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to resources
          </TenantLink>

          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#D4836A]" />
              <span className="text-[#D4836A] text-xs font-semibold uppercase tracking-wider">
                Video
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold text-[#FAF9F6] leading-[1.1] mb-5">
              {resource.title}
            </h1>
            <p className="text-[#A8A29E] text-lg max-w-[760px] leading-relaxed">
              {resource.description}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-sm text-[#A8A29E]">
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4836A]" />
                Featuring{" "}
                {resource.speakers.map((s, i) => (
                  <span key={s.name} className="text-[#FAF9F6]">
                    {s.name}
                    {i < resource.speakers.length - 1 ? " & " : ""}
                  </span>
                ))}
              </span>
              {resource.tags.length > 0 && (
                <span className="flex flex-wrap items-center gap-2">
                  {resource.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-full text-[0.7rem] font-medium bg-white/[0.06] text-[#D6D3D1] uppercase tracking-wider"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>

          {/* Video player — public, YouTube embed */}
          <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] mb-12 aspect-video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${resource.youtubeId}?rel=0`}
              title={resource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full"
            />
          </div>

          {/* Body grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-16">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-semibold text-[#FAF9F6] mb-5">What you&apos;ll learn</h2>
              <ul className="space-y-3">
                {resource.takeaways.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[#D6D3D1] leading-relaxed">
                    <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-[#D4836A] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 p-5 rounded-2xl border border-white/[0.06] bg-[#2D2926]/60 text-[#A8A29E] text-[0.9375rem] leading-relaxed">
                Whether you&apos;re a solo builder, indie hacker, or just tired of shipping default
                Tailwind, this combo will level up everything you make.
                <a
                  href={`https://www.youtube.com/watch?v=${resource.youtubeId}&sub_confirmation=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-3 text-[#D4836A] hover:text-[#E09880] font-semibold transition-colors"
                >
                  Subscribe on YouTube for more AI dev workflows →
                </a>
              </div>
            </div>

            <aside className="lg:col-span-1">
              <div className="bg-gradient-to-br from-[#D4836A] to-[#C97658] rounded-3xl p-7 text-[#1C1917] sticky top-28">
                <h3 className="text-2xl font-semibold mb-2">Join the community</h3>
                <p className="text-[#1C1917]/80 mb-6 leading-relaxed">
                  Connect with Claude Code builders across {countryName}. Get invited to the next
                  webinar, meetup, and workshop.
                </p>
                <TenantLink
                  href="/community"
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl bg-[#1C1917] text-[#FAF9F6] font-semibold hover:bg-[#292524] hover:-translate-y-0.5 transition-all duration-300 mb-3"
                >
                  Go to Community
                  <ArrowRight className="w-4 h-4" />
                </TenantLink>
                <TenantLink
                  href="/events"
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl bg-[#1C1917]/10 text-[#1C1917] font-semibold border border-[#1C1917]/20 hover:bg-[#1C1917]/15 transition-all duration-300"
                >
                  <Calendar className="w-4 h-4" />
                  Upcoming Events
                </TenantLink>
              </div>
            </aside>
          </div>

          {/* Speakers */}
          <section className="mb-20">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#FAF9F6] mb-2">
              {resource.speakers.length > 1 ? "Featured speakers" : "Featured speaker"}
            </h2>
            <p className="text-[#A8A29E] mb-8">From the {nationality} Claude Code community.</p>
            <div
              className={
                resource.speakers.length > 1
                  ? "grid grid-cols-1 md:grid-cols-2 gap-6"
                  : "grid grid-cols-1 max-w-[640px]"
              }
            >
              {resource.speakers.map((s) => (
                <article
                  key={s.name}
                  className="bg-[#2D2926] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#1C1917] overflow-hidden">
                    <RemoteImage
                      src={s.photo}
                      alt={s.name}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: s.photoPosition }}
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-semibold text-[#FAF9F6]">{s.name}</h3>
                    <div className="flex items-center gap-3 mb-4 mt-1">
                      <p className="text-[#D4836A] text-sm font-medium">{s.company}</p>
                      {s.companyLogo && (
                        <>
                          <span className="text-white/20" aria-hidden>
                            |
                          </span>
                          <RemoteImage
                            src={s.companyLogo}
                            alt={s.companyLogoAlt || s.company}
                            className="h-10 md:h-12 w-auto object-contain max-w-[160px]"
                            style={
                              s.companyLogoInvert
                                ? { filter: "brightness(0) invert(1)" }
                                : undefined
                            }
                          />
                        </>
                      )}
                    </div>
                    <p className="text-[#A8A29E] text-[0.9375rem] leading-relaxed mb-5 flex-1">
                      {s.bio}
                    </p>
                    <div className="flex flex-col gap-2">
                      <a
                        href={s.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#D4836A] hover:text-[#E09880] text-sm font-semibold transition-colors"
                      >
                        Connect on LinkedIn
                        <ArrowRight className="w-4 h-4" />
                      </a>
                      {s.website && (
                        <a
                          href={s.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-[#FAF9F6] text-sm transition-colors"
                        >
                          {s.websiteLabel || s.website}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Discord Promo */}
          <section className="mb-4">
            <DiscordPromoCard
              href={await discordCommunityInvite()}
              logoSrc="/images/webinar-2026-04/discord-logo.png"
            />
          </section>
        </div>
      </main>
    </>
  );
}
