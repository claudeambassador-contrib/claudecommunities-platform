import { BookOpen, HelpCircle, Target, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getTenantConfig();
  const SITE_URL = await siteUrl();
  return {
    title: `Claude Co-work ${config.countryName} | Collaborative AI Working Sessions`,
    description: `Join Claude Code Co-work sessions across ${config.countryName}. Collaborative in-person working sessions where you bring your laptop and work alongside others using Claude Code. Boost productivity, learn from peers, and stay accountable.`,
    keywords: [
      "Claude Code",
      "Claude Code co-work",
      "co-working",
      "AI co-working",
      "collaborative coding",
      `Claude Code ${config.countryName}`,
      "Claude AU",
      "working sessions",
      "productivity",
      "developer community",
    ],
    openGraph: {
      title: "Claude Co-work | Collaborative AI Working Sessions",
      description:
        "Collaborative in-person working sessions where members bring laptops and work together using Claude Code. Boost productivity and learn from peers.",
      url: `${SITE_URL}/cowork`,
      images: [
        {
          url: "/images/claude-code-logo.webp",
          width: 500,
          height: 500,
          alt: `Claude Code Co-work Sessions ${config.countryName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Claude Co-work ${config.countryName} | Collaborative AI Working Sessions`,
      description:
        "Collaborative in-person working sessions where members bring laptops and work together using Claude Code.",
      images: ["/images/claude-code-logo.webp"],
    },
    alternates: {
      canonical: `${SITE_URL}/cowork`,
    },
  };
}

const benefits = [
  {
    icon: Zap,
    title: "Boosted Productivity",
    desc: "The energy of working alongside others keeps you focused and shipping. No more solo procrastination spirals.",
  },
  {
    icon: Users,
    title: "Community & Connection",
    desc: "Meet other people building with Claude Code. Share what you are working on and find collaborators.",
  },
  {
    icon: BookOpen,
    title: "Learn By Osmosis",
    desc: "Pick up new techniques, prompting strategies, and workflows just by being in the room with other builders.",
  },
  {
    icon: Target,
    title: "Accountability",
    desc: "Set a goal at the start of the session and actually follow through. Nothing beats social accountability.",
  },
];

const faqs = [
  {
    q: "Do I need to be an experienced developer?",
    a: "Not at all. Co-work sessions welcome everyone from complete beginners to senior engineers. You just need a laptop and something you want to work on with Claude Code.",
  },
  {
    q: "What should I bring?",
    a: "Your laptop, a charger, and whatever project you want to work on. A Claude Code subscription is helpful but not strictly required. We can help you get set up if you are new.",
  },
  {
    q: "Is this the same as a meetup or workshop?",
    a: "No. Meetups typically have presentations and talks. Co-work sessions are about doing the work. Think of it as a shared office for a few hours where everyone is building with Claude Code.",
  },
  {
    q: "How long are the sessions?",
    a: "Typically 2 to 4 hours. You can arrive late or leave early, but most people find they are most productive when they commit to the full session.",
  },
  {
    q: "Do I need to work on a specific project?",
    a: "You can work on anything. Personal projects, work tasks, learning exercises, or even just exploring Claude Code for the first time. The only requirement is that you are building something.",
  },
  {
    q: "Is it free?",
    a: "Check the specific event listing for details. Most co-work sessions are free or have a small venue fee to cover the space.",
  },
];

export default async function CoworkPage() {
  const config = await getTenantConfig();
  const SITE_URL = await siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/cowork`,
        url: `${SITE_URL}/cowork`,
        name: `Claude Co-work ${config.countryName} | Collaborative AI Working Sessions`,
        description:
          "Collaborative in-person working sessions where members bring laptops and work together using Claude Code.",
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
        about: {
          "@id": `${SITE_URL}/#organization`,
        },
        inLanguage: config.lang,
      },
      {
        "@type": "Event",
        name: "Claude Code Co-work Sessions",
        description:
          "Collaborative in-person working sessions where members bring their laptops and work alongside others using Claude Code. Co-working meets AI-powered productivity.",
        organizer: {
          "@type": "Organization",
          name: config.communityName,
          url: SITE_URL,
        },
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Country",
          name: config.countryName,
        },
        inLanguage: config.lang,
      },
    ],
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted server-built JSON-LD from JSON.stringify(jsonLd), no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="bg-[#D4836A] pt-32 pb-16 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="text-[#1C1917]">
            <div className="inline-block bg-[#1C1917]/15 text-[#1C1917] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1C1917]/20">
              Co-working Meets AI-Powered Productivity
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold leading-[1.15] mb-4">
              Claude Code Co-work Sessions
            </h1>
            <p className="text-lg text-[#1C1917]/80 max-w-[540px] leading-relaxed">
              Bring your laptop. Bring your project. Work alongside other builders using Claude Code
              in a focused, collaborative environment. Get more done together than you ever would
              alone.
            </p>
          </div>
          <div className="flex justify-center">
            <Image
              src="/images/claude-code-logo.webp"
              alt="Claude Code Co-work"
              width={400}
              height={400}
              className="rounded-2xl max-w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-6">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl font-semibold text-center text-[#D4836A] mb-10">Why Co-work?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="bg-[#2D2926] rounded-2xl p-6 border border-white/[0.06]"
              >
                <b.icon className="w-8 h-8 text-[#D4836A] mb-4" />
                <h3 className="text-[#FAF9F6] font-semibold mb-2">{b.title}</h3>
                <p className="text-[#A8A29E] text-[0.9375rem]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-[800px] mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">
              What is Claude Code Co-work?
            </h2>
            <p className="text-[#A8A29E] text-lg mb-4">
              Claude Code Co-work is a collaborative, in-person working session where members of the{" "}
              {config.communityName} come together to build. Everyone brings their laptop, picks a
              project, and works alongside others who are also using Claude Code.
            </p>
            <p className="text-[#A8A29E] text-lg mb-4">
              Think of it as a co-working space meets an AI-powered hackathon, minus the
              competition. There are no presentations, no formal agenda, and no pressure. Just a
              room full of people getting things done with Claude Code as their development partner.
            </p>
            <p className="text-[#A8A29E] text-lg">
              Whether you are building a side project, working through a tutorial, prototyping an
              idea, or tackling real work tasks, the co-work format gives you the focus and
              motivation to make meaningful progress.
            </p>
          </div>

          <div className="bg-[#2D2926] rounded-2xl p-8 border border-[#D4836A]/30 mb-16">
            <h3 className="text-xl font-semibold text-[#D4836A] mb-4">
              What Happens at a Co-work?
            </h3>
            <p className="text-[#A8A29E] mb-6">
              Every session follows a simple structure designed to maximise your productive time:
            </p>
            <ul className="space-y-4 text-[#A8A29E]">
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-[#FAF9F6]">Arrive and set up</strong> - Grab a seat,
                  connect to Wi-Fi, get your development environment ready
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-[#FAF9F6]">Quick introductions</strong> - A brief round
                  where everyone shares what they plan to work on today
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-[#FAF9F6]">Focused work blocks</strong> - The main event.
                  Heads down, building with Claude Code. Ask neighbours for help when you get stuck.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-[#FAF9F6]">Coffee breaks</strong> - Short informal breaks
                  to chat, compare notes, and share interesting discoveries
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#D4836A]/80 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-[#FAF9F6]">Show and tell</strong> - At the end, anyone who
                  wants to can share what they built or what progress they made
                </div>
              </li>
            </ul>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">What People Work On</h2>
            <p className="text-[#A8A29E] text-lg mb-4">
              There is no set topic or curriculum. People bring whatever they are excited about:
            </p>
            <ul className="space-y-4">
              {[
                {
                  title: "Side Projects",
                  desc: "Personal apps, tools, and experiments that never seem to get finished at home",
                },
                {
                  title: "Learning & Exploration",
                  desc: "Trying new frameworks, testing Claude Code features, or working through courses",
                },
                {
                  title: "Work Tasks",
                  desc: "Real work that benefits from focused, uninterrupted time with Claude Code",
                },
                {
                  title: "Open Source Contributions",
                  desc: "Contributing to community projects or starting your own",
                },
                {
                  title: "Prototypes & MVPs",
                  desc: "Rapidly building proof-of-concept apps to test business ideas",
                },
                {
                  title: "Creative Projects",
                  desc: "Generative art, games, interactive experiences, and other creative builds",
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

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-[#D4836A] mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="bg-[#2D2926] rounded-2xl p-6 border border-white/[0.06]"
                >
                  <h3 className="text-[#FAF9F6] font-semibold mb-2 flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-[#D4836A] mt-0.5 flex-shrink-0" />
                    {faq.q}
                  </h3>
                  <p className="text-[#A8A29E] pl-8">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <h2 className="text-2xl font-semibold mb-4">Ready to Co-work?</h2>
            <p className="text-[#A8A29E] mb-8 max-w-[500px] mx-auto">
              Find an upcoming co-work session near you and come build something great alongside the{" "}
              {config.communityName}.
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
