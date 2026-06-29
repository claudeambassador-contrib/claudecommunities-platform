/**
 * Default community reference data every tenant starts with — Spaces and
 * gamification LeaderboardLevels. SINGLE SOURCE OF TRUTH, consumed by every
 * provisioning path so a tenant is usable the moment it's created:
 *   - `provisionTenant()` (the online configurator) — via Prisma `createMany`.
 *   - `buildProvisionSql()` / `seed-reference.ts` (CLI + platform seed) — as SQL.
 *
 * Both Space and LeaderboardLevel are tenant-scoped (migration 0021), so callers
 * MUST stamp `tenantId`; this module only holds the tenant-agnostic content.
 */

export interface DefaultSpace {
  slug: string;
  name: string;
  icon: string;
  description: string;
  order: number;
}

export interface DefaultLeaderboardLevel {
  level: number;
  name: string;
  icon: string;
  minPoints: number;
  color: string;
}

/** Generic, good-for-any-community starter spaces. */
export const DEFAULT_SPACES: readonly DefaultSpace[] = [
  {
    slug: "announcements",
    name: "Announcements",
    icon: "📢",
    description: "Official community announcements",
    order: 1,
  },
  {
    slug: "say-hello",
    name: "Say Hello",
    icon: "👋",
    description: "Introduce yourself to the community",
    order: 2,
  },
  {
    slug: "general",
    name: "General Discussion",
    icon: "💬",
    description: "Chat about anything Claude Code related",
    order: 3,
  },
  {
    slug: "show-tell",
    name: "Show & Tell",
    icon: "✨",
    description: "Share your projects and get feedback",
    order: 4,
  },
  {
    slug: "tips-tricks",
    name: "Tips & Tricks",
    icon: "💡",
    description: "Share your best prompts and workflows",
    order: 5,
  },
  {
    slug: "help",
    name: "Help & Questions",
    icon: "❓",
    description: "Get help from the community",
    order: 6,
  },
];

/** Default 9-tier gamification ladder. */
export const DEFAULT_LEADERBOARD_LEVELS: readonly DefaultLeaderboardLevel[] = [
  { level: 1, name: "Community Ally", icon: "🤝", minPoints: 0, color: "#6B7280" },
  { level: 2, name: "Rising Star", icon: "⭐", minPoints: 100, color: "#CD7F32" },
  { level: 3, name: "Trailblazer", icon: "🔥", minPoints: 300, color: "#C0C0C0" },
  { level: 4, name: "Champion", icon: "🏆", minPoints: 600, color: "#FFD700" },
  { level: 5, name: "Leader", icon: "👑", minPoints: 1000, color: "#8B5CF6" },
  { level: 6, name: "Mentor", icon: "🎓", minPoints: 1500, color: "#3B82F6" },
  { level: 7, name: "Ambassador", icon: "🌟", minPoints: 2500, color: "#14B8A6" },
  { level: 8, name: "Legend", icon: "💎", minPoints: 4000, color: "#D4836A" },
  { level: 9, name: "Hero", icon: "🦸", minPoints: 6000, color: "rainbow" },
];
