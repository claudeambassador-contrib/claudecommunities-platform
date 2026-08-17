export type PageStatus = "draft" | "published";

export type BlockType =
  | "audienceSplit"
  | "benefits"
  | "cta"
  | "discord"
  | "events"
  | "gallery"
  | "hero"
  | "richText"
  | "webinar";

export interface BlockBase {
  enabled: boolean;
  id: string;
}

export interface HeroBlock extends BlockBase {
  badge?: string | null;
  body?: string | null;
  heading?: string | null;
  primaryCtaLabel?: string | null;
  type: "hero";
}

export interface WebinarBlock extends BlockBase {
  description: string;
  href: string;
  thumbnailUrl: string;
  title: string;
  type: "webinar";
}

export interface BenefitCard {
  desc: string;
  icon: string;
  title: string;
}

export interface BenefitsBlock extends BlockBase {
  cards: BenefitCard[];
  heading?: string | null;
  type: "benefits";
}

export interface AudienceCard {
  ctaLabel?: string | null;
  desc: string;
  href: string;
  icon: string;
  title: string;
}

export interface AudienceSplitBlock extends BlockBase {
  cards: AudienceCard[];
  heading?: string | null;
  subheading?: string | null;
  type: "audienceSplit";
}

export interface EventsBlock extends BlockBase {
  type: "events";
}

export interface DiscordBlock extends BlockBase {
  type: "discord";
}

export interface GalleryBlock extends BlockBase {
  heading?: string | null;
  subheading?: string | null;
  type: "gallery";
}

export interface CtaBlock extends BlockBase {
  bodySignedOut?: string | null;
  ctaLabelSignedOut?: string | null;
  headingSignedOut?: string | null;
  type: "cta";
}

export interface RichTextBlock extends BlockBase {
  body: string;
  heading?: string | null;
  type: "richText";
}

export type Block =
  | AudienceSplitBlock
  | BenefitsBlock
  | CtaBlock
  | DiscordBlock
  | EventsBlock
  | GalleryBlock
  | HeroBlock
  | RichTextBlock
  | WebinarBlock;

export interface ContentPageInput {
  blocks: Block[];
  slug: string;
  status?: PageStatus;
  title: string;
}

export interface ContentPageSummary {
  id: string;
  slug: string;
  status: PageStatus;
  title: string;
}

export interface ContentPageDetail extends ContentPageSummary {
  blocks: Block[];
}

export interface PublishedPage {
  blocks: Block[];
  id: string;
  slug: string;
  title: string;
}
