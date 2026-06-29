import {
  ArrowLeft,
  Beer,
  Building2,
  Calendar,
  Database,
  HandHeart,
  MapPin,
  Shirt,
  Trophy,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { REGION } from "@/lib/region";
import { siteUrl } from "@/lib/tenant-config";
import SponsorForm from "./SponsorForm";

export async function generateMetadata(): Promise<Metadata> {
  const BASE_URL = await siteUrl();
  const EVENT_URL = `${BASE_URL}/events/claude-impact-lab-melbourne`;
  const SPONSOR_URL = `${EVENT_URL}/sponsor`;

  return {
    title: "Sponsor the Claude Impact Lab Melbourne — Partnership Opportunities",
    description:
      "Become an event, drinks, catering, venue, swag, data or prize sponsor of Australia's first Claude Impact Lab. Help build AI tools on real Melbourne civic data.",
    keywords: [
      "Claude Impact Lab sponsor",
      "Melbourne hackathon sponsorship",
      "AI hackathon partner",
      "civic tech sponsor",
      "Anthropic sponsor",
      "Melbourne event sponsorship",
    ],
    openGraph: {
      title: "Sponsor the Claude Impact Lab Melbourne",
      description:
        "Partner with Australia's first Claude Impact Lab — event, drinks, catering, venue, swag, data and prize sponsors welcome.",
      url: SPONSOR_URL,
      type: "article",
      siteName: "Claude Code Community Australia",
      locale: "en_AU",
    },
    twitter: {
      card: "summary_large_image",
      title: "Sponsor the Claude Impact Lab Melbourne",
      description:
        "Partner with Australia's first Claude Impact Lab — event, drinks, catering, venue, swag, data and prize sponsors welcome.",
    },
    alternates: {
      canonical: SPONSOR_URL,
    },
  };
}

const SPONSORSHIP_TYPES = [
  {
    icon: Calendar,
    title: "Event sponsor",
    desc: "Headline support — branding across the event, mainstage acknowledgement and an opportunity to address attendees.",
    color: "text-[#D4836A] bg-[#D4836A]/20",
  },
  {
    icon: Beer,
    title: "Drinks sponsor",
    desc: "Cover drinks for the after-party where teams demo their builds and the wider Melbourne tech community comes together.",
    color: "text-amber-400 bg-amber-500/20",
  },
  {
    icon: UtensilsCrossed,
    title: "Catering partner",
    desc: "Fuel the hackers with breakfast, lunch, coffee or snacks. A great fit for local cafes, caterers and food brands.",
    color: "text-orange-400 bg-orange-500/20",
  },
  {
    icon: MapPin,
    title: "Venue partner",
    desc: "Host the hackathon at your space. Ideal for co-working spaces, universities, councils and corporate offices.",
    color: "text-blue-400 bg-blue-500/20",
  },
  {
    icon: Shirt,
    title: "Merch / swag sponsor",
    desc: "Provide t-shirts, stickers, hoodies or tote bags that participants will keep long after the event ends.",
    color: "text-purple-400 bg-purple-500/20",
  },
  {
    icon: Database,
    title: "Data partner",
    desc: "Contribute Melbourne civic datasets or APIs that teams can build on — transport, planning, council records and more.",
    color: "text-green-400 bg-green-500/20",
  },
  {
    icon: Trophy,
    title: "Prize sponsor",
    desc: "Provide cash, hardware, services or credits for winning teams. Get your brand in front of the best builders in Melbourne.",
    color: "text-yellow-400 bg-yellow-500/20",
  },
  {
    icon: HandHeart,
    title: "Something else",
    desc: "Got an idea we haven't thought of? Mentorship, judging, comms, accessibility support — let's talk.",
    color: "text-pink-400 bg-pink-500/20",
  },
];

export default function SponsorClaudeImpactLabMelbourne() {
  if (REGION !== "au") notFound();

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Back link */}
      <div className="pt-[92px] px-6">
        <div className="max-w-4xl mx-auto">
          <TenantLink
            href="/events/claude-impact-lab-melbourne"
            className="inline-flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to event details
          </TenantLink>
        </div>
      </div>

      {/* Hero */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#D4836A]/30 via-[#1C1917] to-[#D4836A]/10 border border-white/[0.06] p-8 md:p-12">
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
                  Sponsorship & Partnerships
                </span>
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/20">
                  Saturday 23 May 2026
                </span>
              </div>

              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
                Sponsor the
                <br />
                <span className="text-[#D4836A]">Claude Impact Lab Melbourne</span>
              </h1>

              <p className="text-lg md:text-xl text-[#A8A29E] mb-6 max-w-2xl leading-relaxed">
                Help us put on Australia&apos;s first Claude Impact Lab. We&apos;re looking for
                sponsors and partners across event, drinks, catering, venue, swag, data and prizes.
              </p>

              <div className="flex flex-wrap gap-6 text-[#A8A29E]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#D4836A]" />
                  <span className="font-medium text-white">Saturday, May 23, 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#D4836A]" />
                  <span>Melbourne, VIC</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#D4836A]" />
                  <span>~150 builders, civic leaders & teams</span>
                </div>
              </div>

              <div className="mt-8">
                <a
                  href="#sponsor-form"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium"
                >
                  Fill out the sponsorship form
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why sponsor */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Why partner with us?
              </h2>
              <div className="space-y-4 text-[#A8A29E] leading-relaxed">
                <p>
                  The Claude Impact Lab is a one-day hackathon where teams build AI-powered tools on
                  real Melbourne civic data — transport, planning, council records and public
                  services. It&apos;s the first event of its kind in Australia and we&apos;re
                  putting it on with Anthropic&apos;s support.
                </p>
                <p>
                  Sponsors and partners aren&apos;t just logos on a website. You&apos;ll be in the
                  room with the builders, civic leaders and community organisers shaping how AI is
                  used in Australian cities.
                </p>
                <p className="text-white font-medium">
                  Tell us how you&apos;d like to be involved and we&apos;ll work out a package that
                  makes sense for both sides.
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
                    <h3 className="text-white font-semibold mb-1">High-signal audience</h3>
                    <p className="text-sm text-[#A8A29E]">
                      Engineers, designers, data scientists, public servants and founders — people
                      who actually ship.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <HandHeart className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Genuine civic impact</h3>
                    <p className="text-sm text-[#A8A29E]">
                      Tools built on the day are showcased on Claude.ai/community and can be picked
                      up by the organisations they were built for.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">First-mover branding</h3>
                    <p className="text-sm text-[#A8A29E]">
                      First Claude Impact Lab in Australia. Founding sponsors get the spotlight.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ways to get involved */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Ways to get involved</h2>
          <p className="text-[#A8A29E] mb-8">
            Pick whatever fits — you can mix and match in the form below.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {SPONSORSHIP_TYPES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-[#A8A29E] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sponsor Form */}
      <section className="px-6 pb-16" id="sponsor-form">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Sponsorship & partnership form
            </h2>
            <p className="text-[#A8A29E] max-w-xl mx-auto">
              Fill this in and we&apos;ll be back to you within a few days to talk through the
              details. Nothing is locked in until you say so.
            </p>
          </div>
          <SponsorForm />
        </div>
      </section>

      {/* Footer CTA back to event */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#2D2926] to-[#1C1917] rounded-2xl border border-white/[0.06] p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-3">
              Want to attend instead of sponsor?
            </h2>
            <p className="text-[#A8A29E] mb-6 max-w-xl mx-auto">
              The event is free for participants. Register your interest as a hacker, designer,
              public servant or community organiser.
            </p>
            <TenantLink
              href="/events/claude-impact-lab-melbourne#register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium border border-white/[0.06]"
            >
              Register early interest
            </TenantLink>
          </div>
        </div>
      </section>
    </div>
  );
}
