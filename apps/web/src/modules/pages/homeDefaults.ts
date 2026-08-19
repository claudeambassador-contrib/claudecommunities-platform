import type { AudienceCard, BenefitCard, Block } from "@/modules/pages/types";

const DEFAULT_BENEFIT_CARDS: BenefitCard[] = [
  {
    desc: "Connect with developers and creators who share your passion for AI-assisted development.",
    icon: "Users",
    title: "Real Community",
  },
  {
    desc: "Discover how others use Claude Code in their workflows. Share tips and best practices.",
    icon: "BookOpen",
    title: "Learn From Peers",
  },
  {
    desc: "Get feedback on your projects, find collaborators, and build higher quality software faster.",
    icon: "Star",
    title: "Ship Better Work",
  },
  {
    desc: "Participate in live coding sessions, workshops, and hackathons. Learn by doing.",
    icon: "LayoutGrid",
    title: "Hands-On Sessions",
  },
];

const DEFAULT_AUDIENCE_CARDS: AudienceCard[] = [
  {
    ctaLabel: "Learn More →",
    desc: "For software engineers, architects, and technical leads integrating Claude Code into production workflows.",
    href: "/professionals",
    icon: "Code",
    title: "Professional Developers",
  },
  {
    ctaLabel: "Learn More →",
    desc: "For creators, entrepreneurs, and curious minds exploring what's possible with AI-assisted development.",
    href: "/vibe-coders",
    icon: "Paintbrush",
    title: "Vibe Coders",
  },
];

/** Code fallback when no published home row exists. Matches Next DEFAULT_HOME_SECTIONS. */
export const DEFAULT_HOME_SECTIONS: Block[] = [
  {
    badge: null,
    body: null,
    enabled: true,
    heading: null,
    id: "hero",
    primaryCtaLabel: null,
    type: "hero",
  },
  { cards: DEFAULT_BENEFIT_CARDS, enabled: true, heading: null, id: "benefits", type: "benefits" },
  {
    cards: DEFAULT_AUDIENCE_CARDS,
    enabled: true,
    heading: null,
    id: "audienceSplit",
    subheading: null,
    type: "audienceSplit",
  },
  { enabled: true, id: "events", type: "events" },
  { enabled: true, id: "discord", type: "discord" },
  { enabled: true, heading: null, id: "gallery", subheading: null, type: "gallery" },
  {
    bodySignedOut: null,
    ctaLabelSignedOut: null,
    enabled: true,
    headingSignedOut: null,
    id: "cta",
    type: "cta",
  },
];
