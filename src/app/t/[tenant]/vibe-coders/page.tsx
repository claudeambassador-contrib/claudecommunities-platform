import type { Metadata } from "next";
import Image from "next/image";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getRegionConfig } from "@/lib/region";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
  const { countryName } = await getTenantConfig();
  const SITE_URL = await siteUrl();

  return {
    title: `Vibe Coders Meetups ${countryName} | Build Without Code | Claude Code ${countryName}`,
    description: `No coding experience needed. Learn vibe coding at Claude Code meetups across ${countryName}. Build apps, websites, and tools using AI. Perfect for creators and entrepreneurs.`,
    keywords: [
      "vibe coding",
      "vibe coder meetup",
      "no-code",
      "AI development",
      "Claude Code",
      `Claude Code ${countryName}`,
      "beginners",
      "creators",
      countryName,
    ],
    openGraph: {
      title: "Vibe Coders Meetups | Build Without Code",
      description:
        "No coding experience needed. Learn vibe coding - build apps, websites, and tools using AI.",
      url: `${SITE_URL}/vibe-coders`,
      images: [
        {
          url: "/images/claude-haiku.png",
          width: 400,
          height: 400,
          alt: "Claude Code Vibe Coders Meetups",
        },
      ],
    },
    alternates: {
      canonical: `${SITE_URL}/vibe-coders`,
    },
  };
}

export default function VibeCodersPage() {
  // "100s apps built by non-developers" is an unsourced placeholder figure; only
  // show the stats strip for the established AU community.
  const { region } = getRegionConfig();
  return (
    <>
      {/* Hero Section */}
      <section className="bg-[#D4836A] pt-32 pb-16 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="text-[#1C1917]">
            <div className="inline-block bg-[#1C1917]/15 text-[#1C1917] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1C1917]/20">
              For Creators & Curious Minds
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold leading-[1.15] mb-4">
              Meetups for Vibe Coders
            </h1>
            <p className="text-lg text-[#1C1917]/80 max-w-[540px] leading-relaxed">
              You do not need to be a developer to build software anymore. Discover what is possible
              when you combine your ideas with AI-powered creation tools.
            </p>
          </div>
          <div className="flex justify-center">
            <Image
              src="/images/claude-haiku.png"
              alt="Claude Haiku"
              width={400}
              height={400}
              className="rounded-2xl max-w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Stats — includes an unsourced figure; AU-only (see note above). */}
      {region === "au" && (
        <section className="py-16 px-6">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { number: "0", label: "Lines of code needed to start" },
              { number: "100s", label: "Apps built by non-developers" },
              { number: "24/7", label: "AI assistant available to help" },
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
      )}

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-[800px] mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">What is Vibe Coding?</h2>
            <p className="text-[#A8A29E] text-lg mb-4">
              Vibe coding is a new way of building software where you describe what you want, and AI
              helps you create it. No computer science degree required. No years of learning syntax.
              Just your ideas and a conversation with Claude.
            </p>
            <p className="text-[#A8A29E] text-lg">
              It is called vibe coding because you are working at the level of vibes and intentions
              rather than nitty-gritty technical details. You focus on{" "}
              <em className="text-[#FAF9F6]">what</em> you want to build, and Claude helps figure
              out <em className="text-[#FAF9F6]">how</em>.
            </p>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">What Can You Build?</h2>
            <p className="text-[#A8A29E] text-lg mb-4">
              People in our community have used vibe coding to create all kinds of projects:
            </p>
            <ul className="space-y-4">
              {[
                {
                  title: "Personal Websites",
                  desc: "Portfolio sites, blogs, and landing pages for your projects or business",
                },
                {
                  title: "Automation Tools",
                  desc: "Scripts that automate repetitive tasks in your work or personal life",
                },
                {
                  title: "Small Business Apps",
                  desc: "Inventory trackers, booking systems, customer databases",
                },
                {
                  title: "Creative Projects",
                  desc: "Interactive art, games, generative music, data visualizations",
                },
                {
                  title: "Prototypes",
                  desc: "Quick mockups to test ideas before investing in full development",
                },
                { title: "Learning Tools", desc: "Custom quizzes, flashcard apps, study trackers" },
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
            <h3 className="text-xl font-semibold text-[#D4836A] mb-4">
              You Might Be a Vibe Coder If...
            </h3>
            <ul className="space-y-3 text-[#A8A29E]">
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                You have ideas for apps or tools but do not know how to code
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                You have tried learning programming but found it frustrating
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                You are a designer, marketer, writer, or other creative professional
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                You are curious about AI and want to explore what is possible
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                You want to automate parts of your work or side projects
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1" />
                You just think building things sounds fun
              </li>
            </ul>
          </div>

          <div className="bg-[#2D2926] rounded-2xl p-8 border border-[#D4836A]/30 mb-16">
            <h3 className="text-xl font-semibold text-[#D4836A] mb-4">No Experience Required</h3>
            <p className="text-[#A8A29E] mb-4">
              Seriously. You do not need to know anything about programming to join a vibe coder
              session. If you can have a conversation and describe what you want to create, you have
              everything you need to get started.
            </p>
            <p className="text-[#A8A29E]">
              The whole point of AI-assisted creation is that the barrier to entry is lower than
              ever. Come as you are.
            </p>
          </div>

          <div className="text-center mt-16">
            <h2 className="text-2xl font-semibold mb-4">Ready to Start Creating?</h2>
            <p className="text-[#A8A29E] mb-8 max-w-[500px] mx-auto">
              Join our next meetup and discover what you can build when you are not limited by
              technical barriers.
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
