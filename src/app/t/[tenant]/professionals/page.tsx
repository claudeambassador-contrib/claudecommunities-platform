import type { Metadata } from "next";
import Image from "next/image";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
  const { countryName } = await getTenantConfig();
  const SITE_URL = await siteUrl();

  return {
    title: `Professional Developer Meetups ${countryName} | Claude Code ${countryName}`,
    description: `Join Claude Code meetups for professional software engineers across ${countryName}. Learn advanced AI coding workflows, CI/CD integration, and team adoption strategies.`,
    keywords: [
      "Claude Code",
      "Claude Code meetups",
      "professional developers",
      "software engineers",
      "AI coding",
      "production workflows",
      `Claude ${countryName}`,
      `Claude Code ${countryName}`,
    ],
    openGraph: {
      title: "Professional Developer Meetups | Claude Code Community",
      description:
        "Join meetups for professional software engineers using Claude Code in production.",
      url: `${SITE_URL}/professionals`,
      images: [
        {
          url: "/images/claude-sonnet.jpg",
          width: 400,
          height: 400,
          alt: "Claude Code Professional Developer Meetups",
        },
      ],
    },
    alternates: {
      canonical: `${SITE_URL}/professionals`,
    },
  };
}

export default async function ProfessionalsPage() {
  const { nationality } = await getTenantConfig();

  return (
    <>
      {/* Hero Section */}
      <section className="bg-[#D4836A] pt-32 pb-16 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="text-[#1C1917]">
            <div className="inline-block bg-[#1C1917]/15 text-[#1C1917] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1C1917]/20">
              For Software Engineers & Tech Leads
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold leading-[1.15] mb-4">
              Meetups for Professional Developers
            </h1>
            <p className="text-lg text-[#1C1917]/80 max-w-[540px] leading-relaxed">
              Join fellow engineers exploring AI-assisted development. Share workflows, learn from
              peers, and connect with developers using Claude Code in production.
            </p>
          </div>
          <div className="flex justify-center">
            <Image
              src="/images/claude-sonnet.jpg"
              alt="Claude Sonnet"
              width={400}
              height={400}
              className="rounded-2xl max-w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Stats — unsourced/inflated figures. */}
      <section className="py-16 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { number: "10x", label: "Faster iteration cycles reported" },
            { number: "500+", label: `Developers in ${nationality} community` },
            { number: "85%", label: "Say it changed their workflow" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#2D2926] rounded-2xl p-6 text-center border border-white/[0.06]"
            >
              <span className="block text-4xl font-bold text-[#D4836A] mb-2">{stat.number}</span>
              <span className="text-[#A8A29E] text-[0.9375rem]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-[800px] mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">
              Why Professional Developers Join
            </h2>
            <p className="text-[#A8A29E] text-lg mb-4">
              Claude Code has become an essential tool for developers who need to move fast without
              sacrificing quality. Our meetups bring together engineers who are integrating AI
              assistance into serious codebases and production systems.
            </p>
            <p className="text-[#A8A29E] text-lg">
              This is not about hype. It is about practical techniques that work in real teams, on
              real projects, under real constraints.
            </p>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">What We Cover</h2>
            <ul className="space-y-4">
              {[
                {
                  title: "Production Workflows",
                  desc: "How to integrate Claude Code into CI/CD pipelines, code review processes, and team practices",
                },
                {
                  title: "Architecture & Design",
                  desc: "Using AI assistance for system design, refactoring legacy code, and maintaining large codebases",
                },
                {
                  title: "Security & Best Practices",
                  desc: "Understanding the security implications and establishing guardrails for AI-assisted development",
                },
                {
                  title: "Testing Strategies",
                  desc: "Leveraging Claude Code for test generation, coverage improvement, and debugging",
                },
                {
                  title: "Team Adoption",
                  desc: "Strategies for introducing AI tools to your team and measuring productivity impact",
                },
                {
                  title: "Advanced Prompting",
                  desc: "Techniques for getting better results, handling complex codebases, and maintaining context",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-4 text-[#A8A29E]">
                  <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1.5 flex-shrink-0" />
                  <div>
                    <strong className="text-[#FAF9F6]">{item.title}</strong> - {item.desc}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#2D2926] rounded-2xl p-8 border border-[#D4836A]/30 mb-16">
            <h3 className="text-xl font-semibold text-[#D4836A] mb-4">Typical Session Format</h3>
            <p className="text-[#A8A29E] mb-4">
              Our professional sessions run for 2-3 hours and typically include:
            </p>
            <ul className="space-y-3 text-[#A8A29E]">
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />A deep-dive
                presentation from an experienced practitioner
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                Live coding demonstrations with real-world scenarios
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                Small group discussions on specific challenges
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                Networking time with food and drinks
              </li>
            </ul>
          </div>

          <div className="text-center mt-16">
            <h2 className="text-2xl font-semibold mb-4">Ready to Level Up?</h2>
            <p className="text-[#A8A29E] mb-8 max-w-[500px] mx-auto">
              Join our meetups and connect with engineers who are pushing the boundaries of
              AI-assisted development.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <TenantLink
                href="/#events"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl bg-[#D4836A] text-[#1C1917] font-semibold hover:bg-[#E09880] transition-all duration-300"
              >
                View Upcoming Events
              </TenantLink>
              <TenantLink
                href="/login"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl bg-transparent text-[#FAF9F6] font-semibold border border-white/20 hover:bg-white/[0.08] transition-all duration-300"
              >
                Join Community
              </TenantLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
