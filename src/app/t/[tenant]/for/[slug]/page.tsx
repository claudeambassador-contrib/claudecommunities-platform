import { ArrowRight, ChevronRight, MapPin, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { capitalCities } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getIndustries, getIndustryBySlug } from "@/lib/industries";
import { INDUSTRY_ICON_MAP } from "@/lib/industry-icons";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";
import type { Vertical } from "@/lib/verticals";

// Tenant-scoped DB read (merged with built-ins) at request time, so admin edits
// show immediately — mirrors the cities/sitemap precedent.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vertical = await getIndustryBySlug(slug);

  if (!vertical) {
    return { title: "Page Not Found" };
  }

  const baseUrl = await siteUrl();
  const { communityName } = await getTenantConfig();
  const url = `${baseUrl}/for/${vertical.slug}`;

  return {
    title: vertical.title,
    description: vertical.description,
    keywords: vertical.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: vertical.ogTitle,
      description: vertical.ogDescription,
      url,
      type: "website",
      siteName: communityName,
      locale: await ogLocale(),
      images: [
        {
          url: "/images/claude-code-logo.webp",
          width: 500,
          height: 500,
          alt: `Claude Code for ${vertical.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: vertical.ogTitle,
      description: vertical.ogDescription,
      images: ["/images/claude-code-logo.webp"],
    },
  };
}

function JsonLd({
  vertical,
  baseUrl,
  communityName,
}: {
  vertical: Vertical;
  baseUrl: string;
  communityName: string;
}) {
  const url = `${baseUrl}/for/${vertical.slug}`;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: communityName,
    url: baseUrl,
    logo: `${baseUrl}/images/claude-code-logo.webp`,
    sameAs: [],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Industries",
        item: `${baseUrl}/for`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: vertical.name,
        item: url,
      },
    ],
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: vertical.title,
    description: vertical.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: communityName,
      url: baseUrl,
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: vertical.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const schemas = [organizationSchema, breadcrumbSchema, webPageSchema, faqSchema];

  return (
    <>
      {schemas.map((schema) => (
        <script
          key={schema["@type"]}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data built from trusted server-side config and serialized via JSON.stringify; standard Next.js pattern
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export default async function VerticalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vertical = await getIndustryBySlug(slug);

  if (!vertical) {
    notFound();
  }

  const allVerticals = await getIndustries();
  const relatedVerticals = allVerticals.filter((v) => vertical.relatedVerticals.includes(v.slug));
  const capitals = capitalCities(await getCities());
  const baseUrl = await siteUrl();
  const { communityName, countryName } = await getTenantConfig();

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <JsonLd vertical={vertical} baseUrl={baseUrl} communityName={communityName} />

      {/* Hero Section */}
      <section className="pt-[92px] pb-16 px-6 bg-gradient-to-b from-[#D4836A]/10 to-transparent">
        <div className="max-w-[1200px] mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A]/20 rounded-full text-[#D4836A] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            {vertical.heroBadge}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{vertical.heroHeading}</h1>
          <p className="text-xl text-[#A8A29E] max-w-2xl mb-8">{vertical.heroSubheading}</p>
          <div className="flex flex-wrap gap-4">
            <TenantLink
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
            >
              <Users className="w-5 h-5" />
              Join the Community
            </TenantLink>
            <TenantLink
              href="/events"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium rounded-xl transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              View Events
            </TenantLink>
          </div>
        </div>
      </section>

      {/* Benefits Banner */}
      <section className="py-12 px-6 border-y border-white/[0.06] bg-[#2D2926]/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {vertical.benefits.map((benefit) => (
              <div key={benefit.label} className="text-center">
                <div className="text-3xl font-bold text-white">{benefit.stat}</div>
                <div className="text-sm text-[#A8A29E]">{benefit.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intro Content */}
      <section className="py-16 px-6">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            Why {vertical.name} Developers Choose Claude Code
          </h2>
          <div className="space-y-4">
            {vertical.introParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-[#A8A29E] leading-relaxed text-lg">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Grid */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 text-center">
            What You Can Build
          </h2>
          <p className="text-[#A8A29E] text-center mb-12 max-w-2xl mx-auto">
            Claude Code accelerates every part of {vertical.name.toLowerCase()} development. Here
            are the most popular use cases from our community.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vertical.useCases.map((useCase) => {
              const Icon = INDUSTRY_ICON_MAP[useCase.icon] ?? INDUSTRY_ICON_MAP.Code;
              return (
                <div
                  key={useCase.title}
                  className="p-6 bg-[#2D2926] rounded-2xl border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#D4836A]/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#D4836A]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{useCase.title}</h3>
                  <p className="text-[#A8A29E] text-sm leading-relaxed">{useCase.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Deep-Dive */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center">
            How Claude Code Works for {vertical.name}
          </h2>
          <div className="space-y-16">
            {vertical.features.map((feature) => (
              <div key={feature.title}>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-[#A8A29E] leading-relaxed mb-6">{feature.description}</p>
                <ul className="space-y-3">
                  {feature.bulletPoints.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-[#A8A29E]">
                      <ChevronRight className="w-5 h-5 text-[#D4836A] shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {vertical.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group bg-[#2D2926] rounded-xl border border-white/[0.06]"
              >
                <summary className="flex items-center justify-between cursor-pointer p-6 text-white font-medium list-none">
                  <span className="pr-4">{faq.question}</span>
                  <ChevronRight className="w-5 h-5 text-[#78716C] group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <div className="px-6 pb-6 text-[#A8A29E] leading-relaxed">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-transparent to-[#D4836A]/10">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A]/20 rounded-full text-[#D4836A] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Join the community
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{vertical.ctaHeading}</h2>
          <p className="text-xl text-[#A8A29E] mb-8">{vertical.ctaDescription}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TenantLink
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#D4836A] hover:bg-[#c4775f] text-white font-semibold rounded-xl transition-colors"
            >
              <Users className="w-5 h-5" />
              Join the Community
            </TenantLink>
            <TenantLink
              href="/events"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.05] hover:bg-white/[0.1] text-white font-semibold rounded-xl transition-colors"
            >
              View Upcoming Events
              <ArrowRight className="w-5 h-5" />
            </TenantLink>
          </div>
        </div>
      </section>

      {/* Related Verticals */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">
            Explore Other Industries
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {relatedVerticals.map((rv) => (
              <TenantLink
                key={rv.slug}
                href={`/for/${rv.slug}`}
                className="group p-6 bg-[#2D2926] rounded-2xl border border-white/[0.06] hover:border-[#D4836A]/50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white group-hover:text-[#D4836A] transition-colors mb-2">
                  Claude Code for {rv.name}
                </h3>
                <p className="text-sm text-[#A8A29E] mb-4">{rv.tagline}</p>
                <span className="text-sm text-[#D4836A] font-medium flex items-center gap-1">
                  Learn more <ArrowRight className="w-4 h-4" />
                </span>
              </TenantLink>
            ))}
          </div>
        </div>
      </section>

      {/* City Links */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3 text-center">Find a Meetup Near You</h2>
          <p className="text-[#A8A29E] text-center mb-8">
            Claude Code Community meetups run in capital cities across {countryName}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {capitals.map((city) => (
              <TenantLink
                key={city.slug}
                href={`/cities/${city.slug}`}
                className="p-4 bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-[#D4836A]/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#78716C] group-hover:text-[#D4836A] transition-colors" />
                  <div>
                    <span className="font-medium text-white">{city.name}</span>
                    <span className="text-xs text-[#78716C] ml-2">{city.state}</span>
                  </div>
                </div>
              </TenantLink>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
