import {
  ArrowLeft,
  Award,
  Building2,
  Calendar,
  Clock,
  Code,
  MapPin,
  Sprout,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";
import InterestForm from "./InterestForm";

export async function generateMetadata(): Promise<Metadata> {
  const BASE_URL = await siteUrl();
  const EVENT_URL = `${BASE_URL}/events/claude-impact-lab-melbourne`;

  return {
    title: "Claude Impact Lab Melbourne — May 23, 2026 | Build AI for Your City",
    description:
      "Australia's first Claude Impact Lab. A one-day hackathon where teams build AI tools on real Melbourne civic data — transport, planning, public safety, council records. Powered by Anthropic.",
    keywords: [
      "Claude Impact Lab",
      "Melbourne hackathon",
      "civic tech",
      "AI hackathon Melbourne",
      "Anthropic",
      "Claude AI",
      "smart city",
      "civic data",
      "Melbourne",
    ],
    openGraph: {
      title: "Claude Impact Lab Melbourne — May 23, 2026",
      description:
        "Australia's first Claude Impact Lab. Build AI tools on real Melbourne civic data in one day.",
      url: EVENT_URL,
      type: "article",
      siteName: "Claude Code Community Australia",
      locale: "en_AU",
      images: [
        {
          url: `${BASE_URL}/images/claude-code-logo.webp`,
          width: 1200,
          height: 630,
          alt: "Claude Impact Lab Melbourne",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Claude Impact Lab Melbourne — May 23, 2026",
      description:
        "Australia's first Claude Impact Lab. Build AI tools on real Melbourne civic data in one day.",
    },
    alternates: {
      canonical: EVENT_URL,
    },
  };
}

async function JsonLd() {
  const { siteUrl: BASE_URL, currency } = await getTenantConfig();
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Claude Impact Lab Melbourne",
    description:
      "A one-day hackathon where teams partner with local government and nonprofits to build AI-powered tools that solve real problems using Melbourne civic data.",
    startDate: "2026-05-23T09:00:00+10:00",
    endDate: "2026-05-23T18:00:00+10:00",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: "Melbourne (Venue TBA)",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Melbourne",
        addressRegion: "VIC",
        addressCountry: "AU",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Claude Code Community Australia",
      url: BASE_URL,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: currency,
      availability: "https://schema.org/PreOrder",
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted JSON-LD built server-side from JSON.stringify of a static schema object (no user HTML)
      dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
    />
  );
}

export default async function ClaudeImpactLabMelbourne() {
  return (
    <div className="min-h-screen bg-[#1C1917]">
      <JsonLd />

      {/* Back link */}
      <div className="pt-[92px] px-6">
        <div className="max-w-4xl mx-auto">
          <TenantLink
            href="/events"
            className="inline-flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </TenantLink>
        </div>
      </div>

      {/* Hero */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#D4836A]/30 via-[#1C1917] to-[#D4836A]/10 border border-white/[0.06] p-8 md:p-12 lg:p-16">
            {/* Decorative grid */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#D4836A]/20 text-[#D4836A] border border-[#D4836A]/20">
                  Hackathon
                </span>
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/20">
                  First in Australia
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                Claude Impact Lab
                <br />
                <span className="text-[#D4836A]">Melbourne</span>
              </h1>

              <p className="text-xl md:text-2xl text-[#A8A29E] mb-8 max-w-2xl leading-relaxed">
                One day. Real city data. AI tools that actually matter.
              </p>

              <div className="flex flex-wrap gap-6 text-[#A8A29E]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#D4836A]" />
                  <span className="font-medium text-white">Saturday, May 23, 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#D4836A]" />
                  <span>Melbourne, VIC (Venue TBA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#D4836A]" />
                  <span>Full day event</span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4836A] hover:bg-[#C4735A] text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Register interest
                </a>
                <TenantLink
                  href="/events/claude-impact-lab-melbourne/sponsor"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium text-sm border border-white/[0.1]"
                >
                  Sponsor or partner with us
                </TenantLink>
                <TenantLink
                  href="/impact-lab"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium text-sm border border-white/[0.1]"
                >
                  <Users className="w-4 h-4 text-[#D4836A]" />
                  Participant portal
                </TenantLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is the Impact Lab */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                What is a Claude Impact Lab?
              </h2>
              <div className="space-y-4 text-[#A8A29E] leading-relaxed">
                <p>
                  A Claude Impact Lab is a one-day hackathon where teams partner with local
                  government and nonprofits to build AI-powered tools that solve real problems in
                  their city.
                </p>
                <p>
                  The first Impact Lab was held in San Diego, where 27 teams spent a single Saturday
                  building tools on top of real city data — permitting records, parking systems,
                  public safety incidents, council meeting transcripts.
                </p>
                <p>
                  Now it's Melbourne's turn. This will be the{" "}
                  <strong className="text-white">first Claude Impact Lab in Australia</strong>, and
                  we're partnering with Anthropic to bring it to life.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D4836A]/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-[#D4836A]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Real civic data</h3>
                    <p className="text-sm text-[#A8A29E]">
                      Work with actual Melbourne datasets — transport, planning, council records,
                      public services. Not toy data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Code className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Build with Claude</h3>
                    <p className="text-sm text-[#A8A29E]">
                      Every participant gets API credits. Build agents, chatbots, dashboards, or
                      anything that makes city data accessible.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <Sprout className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Impact that lasts</h3>
                    <p className="text-sm text-[#A8A29E]">
                      The best tools get showcased on Claude.ai/community and can be adopted by the
                      organisations they were built for.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
            What participants get
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: <Zap className="w-6 h-6" />,
                title: "API Credits",
                desc: "$50 in Claude API credits for every participant, $500 for winning teams",
                color: "text-amber-400 bg-amber-500/20",
              },
              {
                icon: <Award className="w-6 h-6" />,
                title: "Expert Judges",
                desc: "An Anthropic representative on the judging panel (best effort)",
                color: "text-purple-400 bg-purple-500/20",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Community",
                desc: "Work alongside developers, designers, civic hackers, and domain experts",
                color: "text-blue-400 bg-blue-500/20",
              },
              {
                icon: <Sprout className="w-6 h-6" />,
                title: "Merch & More",
                desc: "Limited edition swag for all participants and winners",
                color: "text-green-400 bg-green-500/20",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5 text-center"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-3`}
                >
                  {item.icon}
                </div>
                <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-[#A8A29E]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The vision */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#2D2926] to-[#1C1917] rounded-2xl border border-white/[0.06] p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Why Melbourne?</h2>
            <div className="space-y-4 text-[#A8A29E] leading-relaxed">
              <p>
                Melbourne is one of the most data-forward cities in Australia. Open data portals,
                transport APIs, council records, planning documents — there's a wealth of public
                information that could transform how residents navigate government and how the city
                allocates resources.
              </p>
              <p>
                The problem isn't data. It's accessibility. Information is buried in PDFs, locked in
                portals, and siloed across systems that were never designed to talk to each other.
                AI can change that — not in a three-year roadmap, but in a single day.
              </p>
              <p className="text-white font-medium">
                The Claude Impact Lab is where builders prove what's possible when you point AI at
                real civic challenges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who should come */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            Who should register interest?
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Developers and engineers who want to build tools that matter",
              "Data scientists and analysts who know how to wrangle public datasets",
              "Designers and UX people who can make civic tools actually usable",
              "Public servants and council staff who understand the real pain points",
              "Community organisers and nonprofit workers who see the gaps every day",
              "Students and new grads who want hands-on experience with AI",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#D4836A] mt-2 shrink-0" />
                <span className="text-[#A8A29E]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interest Form */}
      <section className="px-6 pb-16" id="register">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Register early interest
              </h2>
              <p className="text-[#A8A29E] mb-6 leading-relaxed">
                This is an early interest form — not a final registration. We're gauging numbers and
                building a list of people who want to be part of this. You'll be first to hear when
                registrations open.
              </p>
              <div className="space-y-3 text-sm text-[#78716C]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Saturday, May 23, 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>Melbourne, VIC — Venue TBA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Free to attend</span>
                </div>
              </div>
            </div>

            <InterestForm />
          </div>
        </div>
      </section>

      {/* Sponsor / Partner CTA */}
      <section className="px-6 pb-16" id="sponsor">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#D4836A]/20 to-[#2D2926] rounded-2xl border border-[#D4836A]/20 p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-[#D4836A]/20 text-[#D4836A] border border-[#D4836A]/20 mb-3">
                  Sponsors & partners
                </span>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Want to be an event, drinks, catering or venue sponsor?
                </h2>
                <p className="text-[#A8A29E] mb-2">
                  We&apos;re looking for partners across{" "}
                  <strong className="text-white">
                    event, drinks, catering, venue, swag, data and prize
                  </strong>{" "}
                  sponsorship — plus anyone with another way to help.
                </p>
                <p className="text-[#A8A29E]">
                  Fill in the sponsorship form and we&apos;ll be in touch within a few days.
                </p>
              </div>
              <div className="shrink-0">
                <TenantLink
                  href="/events/claude-impact-lab-melbourne/sponsor"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium whitespace-nowrap"
                >
                  Sponsor or partner with us
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </TenantLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#2D2926] to-[#1C1917] rounded-2xl border border-white/[0.06] p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-3">Join the Claude Code Community</h2>
            <p className="text-[#A8A29E] mb-6 max-w-xl mx-auto">
              Connect with other builders working on civic AI, Claude tooling and more.
            </p>
            <TenantLink
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium border border-white/[0.06]"
            >
              Join the Community
            </TenantLink>
          </div>
        </div>
      </section>
    </div>
  );
}
