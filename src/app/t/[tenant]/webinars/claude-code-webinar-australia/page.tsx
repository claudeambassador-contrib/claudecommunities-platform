import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, ArrowRight, Calendar, Lock, PlayCircle, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscordPromoCard from "@/components/DiscordPromoCard";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { REGION } from "@/lib/region";
import { discordCommunityInvite, getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";

const YOUTUBE_VIDEO_ID = "3-G3raRMl4w";
const YOUTUBE_THUMBNAIL = `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`;
const YOUTUBE_EMBED_URL = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`;

const TITLE = "Claude Webinar — Claude Community Australia";
const DESCRIPTION =
  "Watch the Claude Community Australia webinar with Rye Smith and Dominik Fretz. A practical look at how Australian developers and founders are using Claude Code to ship faster.";

export async function generateMetadata(): Promise<Metadata> {
  const BASE_URL = await siteUrl();
  const PAGE_URL = `${BASE_URL}/webinars/claude-code-webinar-australia`;
  const { communityName } = await getTenantConfig();

  return {
    title: `${TITLE} | ${communityName}`,
    description: DESCRIPTION,
    keywords: [
      "Claude webinar",
      "Claude Code webinar",
      "Claude Community Australia",
      "Claude AI Australia",
      "Rye Smith",
      "Dominik Fretz",
      "Claude Code AU",
    ],
    alternates: {
      canonical: PAGE_URL,
    },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: PAGE_URL,
      type: "video.other",
      siteName: communityName,
      locale: await ogLocale(),
      images: [
        {
          url: YOUTUBE_THUMBNAIL,
          width: 1280,
          height: 720,
          alt: TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: [YOUTUBE_THUMBNAIL],
    },
  };
}

const speakers = [
  {
    name: "Vanessa Ennis",
    talk: "Claude Code for a non-technical person",
    photo: "/images/webinar-2026-04/New_Project__16_-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/vanessa-ennis-2b50515b/",
  },
  {
    name: "Mark Monfort",
    talk: "I build with Claude. And break capability barriers — every single day.",
    photo: "/images/webinar-2026-04/New_Project__12_-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/markmonfort/",
  },
  {
    name: "Stephen Colman",
    talk: "Claude for Non-Techie Builders",
    photo: "/images/webinar-2026-04/New_Project__13_-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/stephencolman/",
  },
  {
    name: "Nick Lothian",
    talk: "Ghost libraries",
    photo: "/images/webinar-2026-04/New_Project__15_-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/nicklothian/",
  },
  {
    name: "Aidan Morgan",
    talk: "Stop building software like it's April 2026 — building complex systems with Agentic Engineering Teams",
    photo: "/images/webinar-2026-04/New_Project__17_-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/aidanjmorgan/",
  },
  {
    name: "Bojan Zivic",
    talk: "From Product Manager to Engineer",
    photo: "/images/webinar-2026-04/New_Project__14_-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/bojan-zivic-65431033/",
  },
  {
    name: "Adam Holt",
    talk: "From cyclone warning to live aggregator in a few hours — a build story",
    photo: "/images/webinar-2026-04/XxRZDYF-removebg-preview.png",
    linkedin: "https://www.linkedin.com/in/adamjohnholt/",
  },
];

const takeaways = [
  "How Australian teams are integrating Claude Code into real workflows",
  "Seven lightning talks from builders across the country",
  "Patterns and pitfalls when shipping AI-assisted features to production",
  "Q&A with the community on what's working right now",
];

export default async function WebinarPage() {
  if (REGION !== "au") notFound();

  const { userId } = await auth();
  const posterUrl = YOUTUBE_THUMBNAIL;
  const isSignedIn = !!userId;

  const BASE_URL = await siteUrl();
  const { communityName, countryName } = await getTenantConfig();
  const discordInviteUrl = await discordCommunityInvite();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: TITLE,
    description: DESCRIPTION,
    thumbnailUrl: YOUTUBE_THUMBNAIL,
    uploadDate: "2026-04-22",
    embedUrl: YOUTUBE_EMBED_URL,
    publisher: {
      "@type": "Organization",
      name: communityName,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/images/claude-code-logo.webp`,
      },
    },
  };

  const hosts = [
    {
      name: "Rye Smith",
      company: communityName,
      photo: "/images/webinar-2026-04/rye.png",
      photoPosition: "center 30%",
      linkedin: "https://www.linkedin.com/in/ryesmithspruik/",
      website: "https://spruik.co",
      websiteLabel: "spruik.co",
      companyLogo: "/images/webinar-2026-04/spruik-logo-white.png",
      companyLogoAlt: "Spruik Co",
      companyLogoInvert: false,
      bio: "Rye started building websites when he was 11 and has kept the passion for tech all the way through. Rye's a fellow Anthropic Claude Ambassador and runs Spruik Co, an SEO and web development agency specialising in getting businesses and products found online. He's worked with startups and entrepreneurs as an advisor, launched over 50 production quality apps for clients since 2015 and has been an early adopter of Claude, using it daily to ship faster and help clients turn ideas into real, revenue-generating products.",
    },
    {
      name: "Dominik Fretz",
      company: communityName,
      photo: "/images/webinar-2026-04/Dom-Casual.png",
      photoPosition: "center top",
      linkedin: "https://www.linkedin.com/in/dominikfretz/",
      website: "https://harbouredgeintelligence.au",
      websiteLabel: "harbouredgeintelligence.au",
      companyLogo: "/images/webinar-2026-04/hei-logo.png",
      companyLogoAlt: "Harbour Edge Intelligence",
      companyLogoInvert: true,
      bio: "Dom has been coding since age 11 and has spent 25+ years in tech across international banks, startups, and deep-sea robotics. He's an Anthropic Claude Ambassador and the founder of Harbour Edge Intelligence, a Sydney-based AI agency focused on agentic coding, engineering training, and security-aware AI implementation. HEI helps technical teams build with AI properly, not just quickly.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data from a trusted internal object serialized via JSON.stringify; no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="bg-[#1C1917] min-h-screen pt-28 pb-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <TenantLink
            href="/"
            className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-[#FAF9F6] text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </TenantLink>

          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#D4836A]" />
              <span className="text-[#D4836A] text-xs font-semibold uppercase tracking-wider">
                Webinar
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold text-[#FAF9F6] leading-[1.1] mb-5">
              {TITLE}
            </h1>
            <p className="text-[#A8A29E] text-lg max-w-[700px] leading-relaxed">{DESCRIPTION}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-sm text-[#A8A29E]">
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4836A]" />
                Hosted by{" "}
                {hosts.map((h, i) => (
                  <span key={h.name} className="text-[#FAF9F6]">
                    {h.name}
                    {i < hosts.length - 1 ? " & " : ""}
                  </span>
                ))}
              </span>
            </div>
          </div>

          {/* Player — gated to signed-in members */}
          {isSignedIn ? (
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] mb-12 aspect-video">
              <iframe
                src={YOUTUBE_EMBED_URL}
                title={TITLE}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] mb-12 aspect-video">
              <RemoteImage
                src={posterUrl}
                alt={TITLE}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-full bg-[#D4836A] flex items-center justify-center mb-5 shadow-[0_8px_30px_rgba(212,131,106,0.4)]">
                  <Lock className="w-7 h-7 text-[#1C1917]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold text-[#FAF9F6] mb-3 max-w-[600px]">
                  Sign in to watch the webinar
                </h2>
                <p className="text-[#A8A29E] max-w-[480px] mb-7 leading-relaxed">
                  This recording is exclusive to Claude Community Australia members. Join the
                  community — it&apos;s free.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <TenantLink
                    href="/login?redirect_url=/webinars/claude-code-webinar-australia"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#D4836A] text-[#1C1917] font-semibold hover:bg-[#E09880] hover:-translate-y-0.5 transition-all duration-300 shadow-lg"
                  >
                    <PlayCircle className="w-5 h-5" />
                    Sign In to Watch
                  </TenantLink>
                  <TenantLink
                    href="/signup?redirect_url=/webinars/claude-code-webinar-australia"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/[0.08] text-[#FAF9F6] font-semibold border border-white/[0.12] hover:bg-white/[0.14] transition-all duration-300"
                  >
                    Join the Community
                  </TenantLink>
                </div>
              </div>
            </div>
          )}

          {/* Body grid: takeaways + sidebar CTA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-16">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-semibold text-[#FAF9F6] mb-5">
                What this webinar covers
              </h2>
              <ul className="space-y-3">
                {takeaways.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[#D6D3D1] leading-relaxed">
                    <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-[#D4836A] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
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
                  href="/#events"
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl bg-[#1C1917]/10 text-[#1C1917] font-semibold border border-[#1C1917]/20 hover:bg-[#1C1917]/15 transition-all duration-300"
                >
                  <Calendar className="w-4 h-4" />
                  Upcoming Events
                </TenantLink>
              </div>
            </aside>
          </div>

          {/* Hosts */}
          <section className="mb-20">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#FAF9F6] mb-2">Your hosts</h2>
            <p className="text-[#A8A29E] mb-8">
              Two Anthropic Claude Ambassadors running the Australian community.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hosts.map((h) => (
                <article
                  key={h.name}
                  className="bg-[#2D2926] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#1C1917] overflow-hidden">
                    <RemoteImage
                      src={h.photo}
                      alt={h.name}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: h.photoPosition }}
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-semibold text-[#FAF9F6]">{h.name}</h3>
                    <div className="flex items-center gap-3 mb-4 mt-1">
                      <p className="text-[#D4836A] text-sm font-medium">{h.company}</p>
                      <span className="text-white/20" aria-hidden>
                        |
                      </span>
                      <RemoteImage
                        src={h.companyLogo}
                        alt={h.companyLogoAlt}
                        className="h-10 md:h-12 w-auto object-contain max-w-[160px]"
                        style={
                          h.companyLogoInvert ? { filter: "brightness(0) invert(1)" } : undefined
                        }
                      />
                    </div>
                    <p className="text-[#A8A29E] text-[0.9375rem] leading-relaxed mb-5 flex-1">
                      {h.bio}
                    </p>
                    <div className="flex flex-col gap-2">
                      <a
                        href={h.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#D4836A] hover:text-[#E09880] text-sm font-semibold transition-colors"
                      >
                        Connect on LinkedIn
                        <ArrowRight className="w-4 h-4" />
                      </a>
                      <a
                        href={h.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-[#FAF9F6] text-sm transition-colors"
                      >
                        {h.websiteLabel}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Speakers */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#FAF9F6] mb-2">
              Speakers & talks
            </h2>
            <p className="text-[#A8A29E] mb-8">Seven builders. Seven lightning talks. One night.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {speakers.map((s, i) => (
                <a
                  key={s.name}
                  href={s.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-[#2D2926] border border-white/[0.06] rounded-2xl p-5 flex flex-col hover:border-[#D4836A]/40 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(212,131,106,0.1)] transition-all duration-300"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#1C1917] border border-white/[0.06] flex-shrink-0">
                      <RemoteImage
                        src={s.photo}
                        alt={s.name}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#D4836A] text-xs font-semibold uppercase tracking-wider mb-0.5">
                        Speaker {String(i + 1).padStart(2, "0")}
                      </p>
                      <h3 className="text-[#FAF9F6] font-semibold truncate">{s.name}</h3>
                    </div>
                  </div>
                  <p className="text-[#D6D3D1] text-[0.9375rem] italic leading-relaxed flex-1">
                    &ldquo;{s.talk}&rdquo;
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[#A8A29E] group-hover:text-[#D4836A] text-xs font-medium transition-colors">
                    LinkedIn
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* Discord Promo */}
          <section className="mb-4">
            <DiscordPromoCard
              href={discordInviteUrl}
              logoSrc="/images/webinar-2026-04/discord-logo.png"
            />
          </section>
        </div>
      </main>
    </>
  );
}
