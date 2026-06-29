import {
  AlertTriangle,
  ArrowLeft,
  Heart,
  Mail,
  MessageCircle,
  Shield,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
  const SITE_URL = await siteUrl();
  return {
    title: "Community Guidelines - Claude Code Community",
    description: `How we behave together in the ${(await getTenantConfig()).communityName}. Be kind, share generously, keep things on-topic, and respect each other's privacy.`,
    alternates: { canonical: `${SITE_URL}/community/guidelines` },
  };
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Heart;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-[#2D2926] border border-white/[0.06] p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#D4836A]/15 flex items-center justify-center text-[#D4836A]">
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="text-[#A8A29E] leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default async function CommunityGuidelinesPage() {
  const config = await getTenantConfig();
  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="pt-[92px] px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <TenantLink
            href="/community"
            className="inline-flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </TenantLink>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Community Guidelines</h1>
          <p className="text-[#A8A29E] mb-10 leading-relaxed">
            We&rsquo;re a community of {config.nationality} builders, founders, and engineers
            exploring what&rsquo;s possible with Claude Code. These guidelines exist so the
            community stays useful, welcoming, and high-signal for everyone.
          </p>

          <div className="space-y-4">
            <Section icon={Heart} title="Be kind, default to charity">
              <p>
                Assume good faith. People come from different backgrounds, companies, and skill
                levels. A junior dev asking a basic question deserves the same respect as a CTO
                sharing a war story.
              </p>
              <p>No personal attacks, harassment, or pile-ons. Disagree with ideas, not people.</p>
            </Section>

            <Section icon={Sparkles} title="Share generously">
              <p>
                The fastest way for the community to grow is for people to share what they&rsquo;re
                building, what&rsquo;s working, and what isn&rsquo;t. Post your CLAUDE.md, your
                prompts, your workflows, your bugs.
              </p>
              <p>
                Credit others when you build on their work. Link to sources. If you&rsquo;re
                reposting something from elsewhere, say so.
              </p>
            </Section>

            <Section icon={MessageCircle} title="Keep it on-topic">
              <p>
                This is a Claude Code community first. Adjacent topics are fine: AI engineering,
                agentic workflows, prompt engineering, dev tooling, and the {config.nationality}{" "}
                tech scene. Off-topic posts may be moved or removed.
              </p>
              <p>
                Use the right space for your post. Pick the most specific one — Sydney chapter,
                vibe-coders, founders, etc. — rather than defaulting to General.
              </p>
            </Section>

            <Section icon={Shield} title="Respect privacy and confidentiality">
              <p>
                Don&rsquo;t share other people&rsquo;s code, conversations, or personal details
                without permission. If you&rsquo;re sharing a Claude transcript, scrub anything
                sensitive.
              </p>
              <p>
                Your employer&rsquo;s code is your employer&rsquo;s. Make sure you have permission
                before sharing internal projects, slides, or screenshots.
              </p>
            </Section>

            <Section icon={AlertTriangle} title="No spam, no scams, no AI slop">
              <p>
                Self-promotion is welcome when it&rsquo;s relevant and occasional. Persistent
                promotion of your product, course, or newsletter without contributing to discussions
                will be removed.
              </p>
              <p>
                Don&rsquo;t post AI-generated walls of text without your own analysis. Don&rsquo;t
                post crypto / referral schemes / MLM / anything that looks like a scam.
              </p>
              <p>
                Don&rsquo;t use the platform to scrape members for sales outreach. Cold-DM&rsquo;ing
                community members about unrelated services is grounds for removal.
              </p>
            </Section>

            <Section icon={Shield} title="Code of conduct at events">
              <p>
                Our meetups, workshops, and online events follow these guidelines too. Inclusive
                language, zero tolerance for harassment, and look out for newcomers.
              </p>
              <p>
                If you witness or experience something that crosses a line at an event, tell an
                organiser immediately. We&rsquo;ll act on it.
              </p>
            </Section>

            <Section icon={Mail} title="Reporting and enforcement">
              <p>
                If you see something that breaks these guidelines, report it to{" "}
                <a
                  href={`mailto:hello@${config.senderDomain}`}
                  className="text-[#D4836A] hover:underline"
                >
                  {`hello@${config.senderDomain}`}
                </a>
                . Reports are kept confidential.
              </p>
              <p>
                Depending on severity, we may remove a post, issue a warning, temporarily suspend an
                account, or permanently remove someone from the community. We err on the side of
                protecting the people doing the right thing.
              </p>
            </Section>
          </div>

          <p className="text-sm text-[#78716C] mt-10 text-center">
            These guidelines may be updated as the community grows. Last updated April 2026.
          </p>
        </div>
      </div>
    </div>
  );
}
