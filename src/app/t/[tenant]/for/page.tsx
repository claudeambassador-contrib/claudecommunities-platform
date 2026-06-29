import { ArrowRight, Building2, Globe, Sparkles, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getIndustries } from "@/lib/industries";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";

// Tenant-scoped DB read (merged with built-ins) at request time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { communityName, countryName } = await getTenantConfig();
  const BASE_URL = await siteUrl();

  return {
    title: `Claude Code for Your Industry | AI-Powered Development ${countryName}`,
    description: `Discover how Claude Code accelerates development across industries — e-commerce, marketing, SaaS, and real estate. Join the ${communityName} for industry-specific meetups, workshops, and resources.`,
    keywords: [
      "Claude Code for ecommerce",
      "Claude Code for marketing",
      "Claude Code for SaaS",
      "Claude Code for real estate",
      "Claude Code industries",
      `AI-powered development ${countryName}`,
      "Claude Code community",
      "Claude Code industry verticals",
      "Claude Code PropTech",
      "Claude Code Shopify",
      "Claude Code landing pages",
      "Claude Code MVP",
    ],
    alternates: {
      canonical: `${BASE_URL}/for`,
    },
    openGraph: {
      title: `Claude Code for Your Industry | AI-Powered Development ${countryName}`,
      description: `Discover how Claude Code accelerates development across industries — e-commerce, marketing, SaaS, and real estate. Join the ${communityName}.`,
      url: `${BASE_URL}/for`,
      type: "website",
      siteName: communityName,
      locale: await ogLocale(),
      images: [
        {
          url: "/images/claude-code-logo.webp",
          width: 500,
          height: 500,
          alt: "Claude Code for Every Industry",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Claude Code for Your Industry | AI-Powered Development ${countryName}`,
      description: `Discover how Claude Code accelerates development across industries — e-commerce, marketing, SaaS, and real estate. Join the ${communityName}.`,
      images: ["/images/claude-code-logo.webp"],
    },
  };
}

function JsonLd({ baseUrl }: { baseUrl: string }) {
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
    ],
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data built from trusted server-side config and serialized via JSON.stringify; standard Next.js pattern
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
    />
  );
}

export default async function IndustriesPage() {
  const { communityName, countryName, nationality } = await getTenantConfig();
  const BASE_URL = await siteUrl();
  const verticals = await getIndustries();

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <JsonLd baseUrl={BASE_URL} />

      {/* Hero Section */}
      <section className="pt-[92px] pb-16 px-6 bg-gradient-to-b from-[#D4836A]/10 to-transparent">
        <div className="max-w-[1200px] mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A]/20 rounded-full text-[#D4836A] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Industry Solutions
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Claude Code for Every Industry
          </h1>
          <p className="text-xl text-[#A8A29E] max-w-2xl mb-8">
            {nationality} developers across every sector are using Claude Code to ship faster, write
            better code, and build products their industries demand. Find your vertical and see
            what&apos;s possible.
          </p>
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

      {/* Industry Cards Grid */}
      <section className="py-16 px-6">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 text-center">
            Choose Your Industry
          </h2>
          <p className="text-[#A8A29E] text-center mb-12 max-w-2xl mx-auto">
            Each industry page covers the use cases, tools, and community resources that matter most
            to developers in that sector.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {verticals.map((vertical) => (
              <TenantLink
                key={vertical.slug}
                href={`/for/${vertical.slug}`}
                className="group p-8 bg-[#2D2926] rounded-2xl border border-white/[0.06] hover:border-[#D4836A]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#D4836A]/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[#D4836A]" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#78716C] group-hover:text-[#D4836A] transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-white group-hover:text-[#D4836A] transition-colors mb-2">
                  Claude Code for {vertical.name}
                </h3>
                <p className="text-[#A8A29E] text-sm leading-relaxed mb-4">{vertical.tagline}</p>
                <span className="text-sm text-[#D4836A] font-medium flex items-center gap-1">
                  Explore {vertical.name} use cases
                  <ArrowRight className="w-4 h-4" />
                </span>
              </TenantLink>
            ))}
          </div>
        </div>
      </section>

      {/* Community Industry Focus */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            Why Industry Focus Matters
          </h2>
          <div className="space-y-4">
            <p className="text-[#A8A29E] leading-relaxed text-lg">
              Every industry has its own frameworks, APIs, compliance requirements, and user
              expectations. A Shopify checkout flow is nothing like a property search interface, and
              a SaaS billing integration has different demands than a marketing analytics pipeline.
              Generic advice only gets you so far.
            </p>
            <p className="text-[#A8A29E] leading-relaxed text-lg">
              The {communityName} organises meetups, workshops, and resources around the verticals
              where our members work. When you join, you connect with developers who understand your
              stack, your APIs, and your users — not just AI in the abstract, but Claude Code
              applied to the problems you actually face.
            </p>
            <p className="text-[#A8A29E] leading-relaxed text-lg">
              Whether you are building storefronts, shipping campaigns, scaling a SaaS product, or
              developing PropTech platforms, our community has members who have done it with Claude
              Code and are willing to share what they have learned.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Banner */}
      <section className="py-12 px-6 border-y border-white/[0.06] bg-[#2D2926]/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[#D4836A]/10 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-[#D4836A]" />
              </div>
              <div className="text-lg font-semibold text-white mb-1">
                Industry-Specific Workflows
              </div>
              <div className="text-sm text-[#A8A29E]">
                Patterns and prompts tailored to your sector
              </div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[#D4836A]/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-[#D4836A]" />
              </div>
              <div className="text-lg font-semibold text-white mb-1">Peer Network</div>
              <div className="text-sm text-[#A8A29E]">
                Connect with developers solving the same problems
              </div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[#D4836A]/10 flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-[#D4836A]" />
              </div>
              <div className="text-lg font-semibold text-white mb-1">{countryName}-wide</div>
              <div className="text-sm text-[#A8A29E]">
                Meetups and events in capital cities across {countryName}
              </div>
            </div>
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
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Build Faster?</h2>
          <p className="text-xl text-[#A8A29E] mb-8">
            Join the {communityName} and connect with developers in your industry. Share workflows,
            attend meetups, and ship better code together.
          </p>
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
    </div>
  );
}
