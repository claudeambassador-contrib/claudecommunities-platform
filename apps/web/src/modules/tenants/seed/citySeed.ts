import { DEFAULT_HOME_SECTIONS } from "@/modules/pages/homeDefaults";
import type { Block } from "@/modules/pages/types";

export const SEED_ADA_EMAIL = "ada@example.com";
export const SEED_ADA_USER_ID = "usr_seed_ada";
export const SEED_OWNER_USER_ID = "usr_seed_owner";
export const SEED_HOME_HEADING = "Welcome to the seeded city";

export interface CitySeedInput {
  now: number;
  orgId: string;
  ownerEmail?: string | null;
}

export interface CitySeedSql {
  registrySql: string;
  tenantSql: string;
}

const SPACES: ReadonlyArray<{
  description: string;
  icon: string;
  name: string;
  slug: string;
}> = [
  {
    description: "Official community announcements",
    icon: "📢",
    name: "Announcements",
    slug: "announcements",
  },
  {
    description: "Introduce yourself to the community",
    icon: "👋",
    name: "Say Hello",
    slug: "say-hello",
  },
  {
    description: "Chat about anything Claude Code related",
    icon: "💬",
    name: "General Discussion",
    slug: "general",
  },
  {
    description: "Share your projects and get feedback",
    icon: "✨",
    name: "Show & Tell",
    slug: "show-tell",
  },
  {
    description: "Share your best prompts and workflows",
    icon: "💡",
    name: "Tips & Tricks",
    slug: "tips-tricks",
  },
  {
    description: "Get help from the community",
    icon: "❓",
    name: "Help & Questions",
    slug: "help",
  },
];

function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function homeBlocks(): Block[] {
  return DEFAULT_HOME_SECTIONS.map((block) =>
    block.type === "hero" ? { ...block, heading: SEED_HOME_HEADING } : block,
  );
}

function insertUser(input: {
  clerkUserId: string;
  displayName: string;
  email: string;
  id: string;
  now: number;
}): string {
  return `INSERT OR IGNORE INTO users (id, clerk_user_id, email, display_name, image_url, is_banned, is_super_admin, created_at, updated_at)
VALUES (${sqlStr(input.id)}, ${sqlStr(input.clerkUserId)}, ${sqlStr(input.email)}, ${sqlStr(input.displayName)}, NULL, 0, 0, ${input.now}, ${input.now});`;
}

function insertMembership(input: {
  id: string;
  now: number;
  orgId: string;
  role: "admin" | "member" | "owner";
  userId: string;
}): string {
  return `INSERT OR IGNORE INTO user_memberships (id, user_id, org_id, role, created_at, updated_at)
VALUES (${sqlStr(input.id)}, ${sqlStr(input.userId)}, ${sqlStr(input.orgId)}, ${sqlStr(input.role)}, ${input.now}, ${input.now});`;
}

export function buildCitySeed(input: CitySeedInput): CitySeedSql {
  const { now, orgId } = input;
  const org = sqlStr(orgId);
  const startsAt = now + 14 * 86_400_000;
  const endsAt = startsAt + 2 * 3_600_000;
  const draftAt = now + 30 * 86_400_000;
  const ownerEmail = input.ownerEmail?.trim().toLowerCase() || null;
  const adaIsOwner = ownerEmail === SEED_ADA_EMAIL;

  const spaceSql = SPACES.map((space, index) => {
    const id = `spc_seed_${space.slug.replace(/-/g, "_")}`;
    return `INSERT OR IGNORE INTO spaces (id, org_id, slug, name, description, icon, color, is_private, sort_order, created_at)
VALUES (${sqlStr(id)}, ${org}, ${sqlStr(space.slug)}, ${sqlStr(space.name)}, ${sqlStr(space.description)}, ${sqlStr(space.icon)}, NULL, 0, ${index + 1}, ${now});`;
  });

  const announceSpace = "spc_seed_announcements";
  const helloSpace = "spc_seed_say_hello";

  const tenantSql = [
    "-- Start city seed (tenant D1). Idempotent: INSERT OR IGNORE.",
    ...spaceSql,
    `INSERT OR IGNORE INTO posts (id, org_id, space_id, author_user_id, title, body, media_url, media_type, is_pinned, created_at, updated_at)
VALUES ('post_seed_announce', ${org}, ${sqlStr(announceSpace)}, ${sqlStr(SEED_ADA_USER_ID)}, 'Welcome to the community', 'This city is seeded for local smoke and e2e walks. Pin this, comment, or start a new thread.', NULL, NULL, 1, ${now}, ${now});`,
    `INSERT OR IGNORE INTO posts (id, org_id, space_id, author_user_id, title, body, media_url, media_type, is_pinned, created_at, updated_at)
VALUES ('post_seed_hello', ${org}, ${sqlStr(helloSpace)}, ${sqlStr(SEED_ADA_USER_ID)}, 'Say hello', 'Ada here — first seeded member. Introduce yourself in this space.', NULL, NULL, 0, ${now + 1}, ${now + 1});`,
    `INSERT OR IGNORE INTO events (id, org_id, slug, title, description, location, city, timezone, event_type, cover_url, status, starts_at, ends_at, max_attendees, is_online, meeting_url, luma_url, luma_event_id, rsvp_enabled, header_text, footer_text, feedback_url, created_at, updated_at)
VALUES ('evt_seed_published', ${org}, 'claude-code-meetup', 'Claude Code Meetup', 'A seeded published meetup so the events list is not empty.', 'The Commons', 'Sydney', 'Australia/Sydney', 'meetup', NULL, 'published', ${startsAt}, ${endsAt}, 40, 0, NULL, NULL, NULL, 1, NULL, NULL, NULL, ${now}, ${now});`,
    `INSERT OR IGNORE INTO events (id, org_id, slug, title, description, location, city, timezone, event_type, cover_url, status, starts_at, ends_at, max_attendees, is_online, meeting_url, luma_url, luma_event_id, rsvp_enabled, header_text, footer_text, feedback_url, created_at, updated_at)
VALUES ('evt_seed_draft', ${org}, 'draft-workshop', 'Draft workshop', 'A seeded draft so admin can distinguish published vs unpublished.', NULL, 'Sydney', 'Australia/Sydney', 'workshop', NULL, 'draft', ${draftAt}, NULL, NULL, 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, ${now}, ${now});`,
    `INSERT OR IGNORE INTO pages (id, org_id, slug, title, body_json, status, created_at, updated_at)
VALUES ('page_seed_home', ${org}, 'home', 'Home', ${sqlStr(JSON.stringify({ blocks: homeBlocks() }))}, 'published', ${now}, ${now});`,
    `INSERT OR IGNORE INTO cities (id, org_id, slug, name, state, state_full, description, is_capital, keywords_json, timezone, position, created_at, updated_at)
VALUES ('city_seed_sydney', ${org}, 'sydney', 'Sydney', 'NSW', 'New South Wales', 'Harbour city — Claude Code meetups and cowork.', 1, ${sqlStr(JSON.stringify(["sydney", "nsw"]))}, 'Australia/Sydney', 0, ${now}, ${now});`,
    `INSERT OR IGNORE INTO cities (id, org_id, slug, name, state, state_full, description, is_capital, keywords_json, timezone, position, created_at, updated_at)
VALUES ('city_seed_melbourne', ${org}, 'melbourne', 'Melbourne', 'VIC', 'Victoria', 'Laneways, coffee, and a growing Claude Code scene.', 0, ${sqlStr(JSON.stringify(["melbourne", "vic"]))}, 'Australia/Melbourne', 1, ${now}, ${now});`,
    ...catalogSeedSql({ now, org, startsAt }),
    "",
  ].join("\n");

  const registryLines = [
    "-- Start city seed (REGISTRY). Idempotent: INSERT OR IGNORE.",
    insertUser({
      clerkUserId: "invite_seed_ada",
      displayName: "Ada Lovelace",
      email: SEED_ADA_EMAIL,
      id: SEED_ADA_USER_ID,
      now,
    }),
    insertMembership({
      id: "mem_seed_ada",
      now,
      orgId,
      role: adaIsOwner ? "owner" : "member",
      userId: SEED_ADA_USER_ID,
    }),
  ];

  if (ownerEmail && !adaIsOwner) {
    registryLines.push(
      insertUser({
        clerkUserId: "invite_seed_owner",
        displayName: "City Owner",
        email: ownerEmail,
        id: SEED_OWNER_USER_ID,
        now,
      }),
      `UPDATE users SET clerk_user_id = 'invite_seed_owner', email = ${sqlStr(ownerEmail)}, display_name = 'City Owner', updated_at = ${now} WHERE id = ${sqlStr(SEED_OWNER_USER_ID)};`,
      insertMembership({
        id: "mem_seed_owner",
        now,
        orgId,
        role: "owner",
        userId: SEED_OWNER_USER_ID,
      }),
      `UPDATE user_memberships SET role = 'owner', updated_at = ${now} WHERE id = 'mem_seed_owner';`,
    );
  }

  return { registrySql: `${registryLines.join("\n")}\n`, tenantSql };
}

function catalogSeedSql(input: { now: number; org: string; startsAt: number }): string[] {
  const { now, org, startsAt } = input;
  const workshopAt = now + 21 * 86_400_000;
  const welcomeBody = JSON.stringify({
    blocks: [
      {
        body: "How to find events, the Discord, and your first meetup.",
        enabled: true,
        heading: "Getting started",
        id: "blk_seed_start",
        type: "richText",
      },
    ],
  });
  const industryBody = JSON.stringify({
    blocks: [
      {
        body: "Shopify themes, checkout flows, and storefronts with Claude Code.",
        enabled: true,
        heading: "E-commerce",
        id: "blk_seed_ecom",
        type: "richText",
      },
    ],
  });
  return [
    `INSERT OR IGNORE INTO event_agenda_items (id, org_id, event_id, type, title, description, starts_at, ends_at, sort_order, created_at, updated_at)
VALUES ('ag_seed_welcome', ${org}, 'evt_seed_published', 'welcome', 'Doors + welcome', 'Badges, coffee, and a quick intro.', ${startsAt}, ${startsAt + 15 * 60_000}, 0, ${now}, ${now});`,
    `INSERT OR IGNORE INTO event_agenda_items (id, org_id, event_id, type, title, description, starts_at, ends_at, sort_order, created_at, updated_at)
VALUES ('ag_seed_talk', ${org}, 'evt_seed_published', 'speaker', 'Live coding with Claude Code', 'A seeded talk so the agenda is not empty.', ${startsAt + 15 * 60_000}, ${startsAt + 60 * 60_000}, 1, ${now}, ${now});`,
    `INSERT OR IGNORE INTO speakers (id, org_id, name, bio, image_url, event_id, sort_order, title, company, talk_title, talk_description, created_at, updated_at)
VALUES ('spk_seed_ada', ${org}, 'Ada Lovelace', 'Seeded speaker for the published meetup.', NULL, 'evt_seed_published', 0, 'Analyst', 'Analytical Engine', 'Live coding with Claude Code', 'A seeded talk.', ${now}, ${now});`,
    `INSERT OR IGNORE INTO courses (id, org_id, slug, title, description, status, created_at, updated_at)
VALUES ('crs_seed_intro', ${org}, 'intro-to-claude-code', 'Intro to Claude Code', 'A seeded self-paced course with one lesson.', 'published', ${now}, ${now});`,
    `INSERT OR IGNORE INTO lessons (id, org_id, course_id, title, body, sort_order, created_at)
VALUES ('les_seed_intro_1', ${org}, 'crs_seed_intro', 'Your first prompt', 'Open a repo, describe the change, and let Claude Code draft it.', 0, ${now});`,
    `INSERT OR IGNORE INTO scheduled_courses (id, org_id, title, slug, description, location, city, timezone, start_time, end_time, is_online, registration_url, course_type, is_published, instructor, created_at, updated_at)
VALUES ('scrs_seed_workshop', ${org}, 'Claude Code workshop', 'claude-code-workshop', 'A seeded scheduled workshop with a registration link.', 'The Commons', 'Sydney', 'Australia/Sydney', ${workshopAt}, ${workshopAt + 2 * 3_600_000}, 0, 'https://example.com/register/claude-code-workshop', 'workshop', 1, 'Ada Lovelace', ${now}, ${now});`,
    `INSERT OR IGNORE INTO pages (id, org_id, slug, title, body_json, status, created_at, updated_at)
VALUES ('page_seed_start', ${org}, 'getting-started', 'Getting started', ${sqlStr(welcomeBody)}, 'published', ${now}, ${now});`,
    `INSERT OR IGNORE INTO pages (id, org_id, slug, title, body_json, status, created_at, updated_at)
VALUES ('page_seed_ecom', ${org}, 'for/ecommerce', 'Claude Code for e-commerce', ${sqlStr(industryBody)}, 'published', ${now}, ${now});`,
    `INSERT OR IGNORE INTO membership_tiers (id, org_id, name, slug, description, price, yearly_price, features_json, color, sort_order, is_active, created_at, updated_at)
VALUES ('tier_seed_free', ${org}, 'Community', 'community', 'Feed, RSVPs, and city meetups.', 0, NULL, ${sqlStr(JSON.stringify(["Community feed", "Event RSVPs"]))}, '#A8A29E', 0, 1, ${now}, ${now});`,
    `INSERT OR IGNORE INTO membership_tiers (id, org_id, name, slug, description, price, yearly_price, features_json, color, sort_order, is_active, created_at, updated_at)
VALUES ('tier_seed_member', ${org}, 'Member', 'member', 'Workshops and the member directory.', 15, 150, ${sqlStr(JSON.stringify(["Workshops", "Member directory", "Early event access"]))}, '#D4836A', 1, 1, ${now}, ${now});`,
    `INSERT OR IGNORE INTO email_campaigns (id, org_id, name, subject, body_html, status, scheduled_at, created_at, updated_at)
VALUES ('cmp_seed_welcome', ${org}, 'Welcome to the city', 'You are in', '<h1>Welcome</h1><p>A seeded campaign so the admin list is not empty.</p>', 'draft', NULL, ${now}, ${now});`,
    `INSERT OR IGNORE INTO email_templates (id, org_id, name, subject, body_html, created_at)
VALUES ('tpl_seed_welcome', ${org}, 'Welcome template', 'Welcome', '<p>Thanks for joining.</p>', ${now});`,
    `INSERT OR IGNORE INTO social_accounts (id, org_id, connector, platform, display_name, external_id, access_token_encrypted, created_at, account_type)
VALUES ('socacc_seed_li', ${org}, 'linkedin', 'linkedin', 'Claude Community Sydney', 'seed_org_li', NULL, ${now}, 'organization');`,
    `INSERT OR IGNORE INTO social_posts (id, org_id, account_id, body, status, scheduled_at, external_id, created_at, updated_at, platform, media_type, media_urls)
VALUES ('socpost_seed_draft', ${org}, 'socacc_seed_li', 'Seeded draft: join us at the next Claude Code meetup.', 'draft', NULL, NULL, ${now}, ${now}, 'linkedin', 'none', '[]');`,
  ];
}
