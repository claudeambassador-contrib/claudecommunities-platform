import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import AudienceSplitBlock from "@/components/home/blocks/AudienceSplitBlock";
import BenefitsBlock from "@/components/home/blocks/BenefitsBlock";
import CtaBlock from "@/components/home/blocks/CtaBlock";
import DiscordBlock from "@/components/home/blocks/DiscordBlock";
import EventsBlock from "@/components/home/blocks/EventsBlock";
import GalleryBlock from "@/components/home/blocks/GalleryBlock";
import HeroBlock from "@/components/home/blocks/HeroBlock";
import RichTextBlock from "@/components/home/blocks/RichTextBlock";
import WebinarBlock from "@/components/home/blocks/WebinarBlock";
import type { HeroBlock as HeroBlockData } from "@/lib/cms/blocks";
import { resolveHero } from "@/lib/cms/defaults";
import { getHomeSections } from "@/lib/cms/home";
import { getTenantConfig, majorCitiesPhrase, ogLocale, siteUrl } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
  const SITE_URL = await siteUrl();
  const cfg = await getTenantConfig();
  const { communityName, countryName, ogImage } = cfg;
  const blocks = await getHomeSections();
  const heroBlock = blocks.find((b): b is HeroBlockData => b.type === "hero");
  // Hero body drives the meta/OG/Twitter DESCRIPTION so it tracks the visible
  // hero. It flows to <meta> attributes only — never into buildJsonLd().
  const heroDescription = resolveHero(heroBlock, cfg).body;

  return {
    // `absolute` bypasses the root layout's "%s | …" title template so the homepage
    // title isn't suffixed into a doubled, over-length title, and keeps it within
    // the ~60-char SERP limit (FAT audit P2). communityName already names the
    // country, so the trailing "Meetups <country>" is dropped.
    title: { absolute: `${communityName} | Claude Code Meetups` },
    description: heroDescription,
    keywords: [
      "Claude Code",
      "Claude Code meetups",
      `Claude ${countryName}`,
      `Claude AI ${countryName}`,
      `Claude Code ${countryName}`,
      "developer meetups",
      "AI coding",
      ...cfg.majorCities,
    ],
    openGraph: {
      title: communityName,
      description: heroDescription,
      url: SITE_URL,
      siteName: communityName,
      locale: await ogLocale(),
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `Claude Code Meetups Across ${countryName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Claude Code Meetups ${countryName} | Claude AI Community`,
      description: heroDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: SITE_URL,
    },
  };
}

// JSON-LD structured data for SEO. Built as a function so the site URL is
// read per render/deploy rather than baked in at module init.
async function buildJsonLd() {
  const SITE_URL = await siteUrl();
  const { communityName, countryName, linkedinUrl, communitySuperlative, lang } =
    await getTenantConfig();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: communityName,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/images/claude-code-logo.webp`,
          width: 500,
          height: 500,
        },
        ...(linkedinUrl ? { sameAs: [linkedinUrl] } : {}),
        description: `${countryName}'s ${communitySuperlative}Claude Code community. Claude Code meetups, workshops, and networking events across ${await majorCitiesPhrase()}. Claude AI ${countryName}.`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: communityName,
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
        inLanguage: lang,
      },
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: `${communityName} | AI-Powered Developer Meetups`,
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
        about: {
          "@id": `${SITE_URL}/#organization`,
        },
        description: `Join ${countryName}'s ${communitySuperlative}Claude Code community. Connect with developers using AI-assisted coding, attend local meetups in ${await majorCitiesPhrase({ conjunction: "&" })}.`,
        inLanguage: lang,
      },
    ],
  };
}

export default async function Home() {
  const { userId } = await auth();
  const clerkUser = userId ? await currentUser() : null;
  const isSignedIn = !!userId;
  const firstName = clerkUser?.firstName || "there";
  const userImage = clerkUser?.imageUrl;
  const jsonLd = await buildJsonLd();
  const blocks = await getHomeSections();
  const cfg = await getTenantConfig();

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is built server-side from buildJsonLd() static config and JSON.stringify'd — no user input, standard Next.js structured-data pattern.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {blocks.map((block) => {
        if (block.enabled === false) return null;
        switch (block.type) {
          case "hero":
            return (
              <HeroBlock
                key={block.id}
                block={block}
                cfg={cfg}
                isSignedIn={isSignedIn}
                firstName={firstName}
                userImage={userImage}
              />
            );
          case "webinar":
            return <WebinarBlock key={block.id} block={block} />;
          case "benefits":
            return <BenefitsBlock key={block.id} block={block} cfg={cfg} />;
          case "audienceSplit":
            return <AudienceSplitBlock key={block.id} block={block} cfg={cfg} />;
          case "events":
            return <EventsBlock key={block.id} />;
          case "discord":
            return <DiscordBlock key={block.id} cfg={cfg} />;
          case "gallery":
            return <GalleryBlock key={block.id} block={block} cfg={cfg} />;
          case "cta":
            return <CtaBlock key={block.id} block={block} cfg={cfg} isSignedIn={isSignedIn} />;
          case "richText":
            return <RichTextBlock key={block.id} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}
