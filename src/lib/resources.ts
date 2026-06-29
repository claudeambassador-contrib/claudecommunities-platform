import { getRegionConfig } from "@/lib/region";

export interface ResourceSpeaker {
  name: string;
  role: string;
  company: string;
  photo: string;
  photoPosition?: string;
  linkedin: string;
  website?: string;
  websiteLabel?: string;
  companyLogo?: string;
  companyLogoAlt?: string;
  companyLogoInvert?: boolean;
  bio: string;
}

export interface VideoResource {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Concise summary used in metadata + JSON-LD */
  summary: string;
  /** Bulleted "what you'll learn" points */
  takeaways: string[];
  youtubeId: string;
  /** ISO date string */
  publishedAt: string;
  /** Approx duration label, e.g. "12 min" */
  duration?: string;
  tags: string[];
  speakers: ResourceSpeaker[];
}

export const RYE_SMITH: ResourceSpeaker = {
  name: "Rye Smith",
  role: "Founder, Spruik Co",
  company: getRegionConfig().communityName,
  photo: "/images/webinar-2026-04/rye.png",
  photoPosition: "center 30%",
  linkedin: "https://www.linkedin.com/in/ryesmithspruik/",
  website: "https://spruik.co",
  websiteLabel: "spruik.co",
  companyLogo: "/images/webinar-2026-04/spruik-logo-white.png",
  companyLogoAlt: "Spruik Co",
  companyLogoInvert: false,
  bio: "Rye started building websites when he was 11 and has kept the passion for tech all the way through. Rye's a fellow Anthropic Claude Ambassador and runs Spruik Co, an SEO and web development agency specialising in getting businesses and products found online. He's worked with startups and entrepreneurs as an advisor, launched over 50 production quality apps for clients since 2015 and has been an early adopter of Claude, using it daily to ship faster and help clients turn ideas into real, revenue-generating products.",
};

export const VIDEO_RESOURCES: VideoResource[] = [
  {
    slug: "claude-code-google-stitch-workflow",
    title: "The Designer's Cheat Code: Claude Code + Google Stitch Workflow",
    shortTitle: "Claude Code + Google Stitch Workflow",
    description:
      "Most devs can build with AI — but the result usually looks like AI built it. In this video, Rye Smith walks through a workflow that fixes that: use Claude Code to actually build the app, then bring in Google Stitch to give it a design your users will love.",
    summary:
      "A practical workflow that pairs Claude Code with Google Stitch so the apps you ship don't look like AI built them — Rye Smith walks through prompting, design hand-off, and wiring it back up.",
    takeaways: [
      "How to prompt Claude Code to scaffold and build a working app",
      "Where AI-generated UIs typically fall flat",
      "How to use Google Stitch to generate clean, modern design directly into your project",
      "Tips for handing design back to Claude Code to wire it up",
    ],
    youtubeId: "741M58bjNLc",
    publishedAt: "2026-05-02",
    tags: ["Claude Code", "Google Stitch", "Design", "Workflow"],
    speakers: [RYE_SMITH],
  },
];

export function getResourceBySlug(slug: string): VideoResource | undefined {
  return VIDEO_RESOURCES.find((r) => r.slug === slug);
}

export function youtubeThumbnail(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;
}
