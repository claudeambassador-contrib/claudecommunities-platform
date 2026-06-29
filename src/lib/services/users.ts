/**
 * Users service — list, profile read/update, role/ban admin ops,
 * email preferences, presence, onboarding, and a thin syncFromClerk wrapper.
 *
 * All callers (API routes + MCP tools) must come through this module.
 */

import { ensureUserInDb } from "@/lib/auth";
import { chunk } from "@/lib/chunk";
import { getActorPermissions, hasPermission } from "@/lib/permissions";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { getWelcomeEmailHtml, sendEmail } from "@/lib/resend";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";
import { recordActivity } from "./activity";
import { assignRoleToUser } from "./roles";

export interface ListUsersOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listUsers({ search, limit = 50, offset = 0 }: ListUsersOptions = {}) {
  const db = await getPrisma();
  const tenantId = await getTenantId();
  // User is GLOBAL — restrict to this tenant's members, and scope the post
  // _count to this tenant (an unfiltered count sums the user's posts everywhere).
  const where = {
    tenantMemberships: { some: { tenantId } },
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      location: true,
      tagline: true,
      role: true,
      points: true,
      level: true,
      createdAt: true,
      _count: { select: { posts: { where: { tenantId } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    image: u.image,
    bio: u.bio,
    location: u.location,
    tagline: u.tagline,
    role: u.role,
    points: u.points || 0,
    level: u.level || 1,
    createdAt: u.createdAt,
    _count: { posts: u._count.posts },
  }));
}

// ── Community members directory ───────────────────────────────────────────
// Powers `/community/members` (initial SSR page) and `GET /api/members`
// (infinite-scroll + search/tab refetch). Paginated server-side so all members
// are reachable, not just the most-recent slice.

export type MemberTab = "all" | "near-me" | "online" | "recent" | "connections";

export interface ListMembersOptions {
  currentUserId: string;
  search?: string;
  tab?: MemberTab;
  limit?: number;
  offset?: number;
}

export interface MemberDTO {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  tagline: string | null;
  location: string | null;
  role: string;
  points: number;
  level: number;
  isOnline: boolean;
  createdAt: string;
  _count: { posts: number };
  badges: { id: string; name: string; icon: string | null; color: string | null }[];
}

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // "recently joined" = last 30 days
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // matches getOnlineUserIds() presence window

// Shared Prisma selection for a member card. Inlined at each call site (Prisma
// needs the literal `true`s to infer the row type), then narrowed to this shape.
type MemberRow = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  tagline: string | null;
  location: string | null;
  role: string;
  points: number;
  level: number;
  isOnline: boolean;
  createdAt: Date;
  _count: { posts: number };
  userBadges: { badge: { id: string; name: string; icon: string | null; color: string | null } }[];
};

// `User` is GLOBAL, so neither the post _count nor the userBadges (both
// tenant-scoped relations reached THROUGH the user) are auto-scoped — each
// carries an explicit `tenantId`, or a member's stats/badges from other tenants
// would bleed in. Parameterized by tenant for that reason.
const memberSelect = (tenantId: string) =>
  ({
    id: true,
    name: true,
    image: true,
    bio: true,
    tagline: true,
    location: true,
    role: true,
    points: true,
    level: true,
    isOnline: true,
    createdAt: true,
    _count: { select: { posts: { where: { tenantId } } } },
    userBadges: {
      where: { tenantId },
      select: { badge: { select: { id: true, name: true, icon: true, color: true } } },
    },
  }) as const;

function toMemberDTO(u: MemberRow): MemberDTO {
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    bio: u.bio,
    tagline: u.tagline,
    location: u.location,
    role: u.role,
    points: u.points || 0,
    level: u.level || 1,
    isOnline: Boolean(u.isOnline),
    createdAt: u.createdAt.toISOString(),
    _count: { posts: u._count.posts },
    badges: u.userBadges.map((ub) => ub.badge),
  };
}

function memberSearchFilter(search?: string) {
  const q = search?.trim();
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q } },
      { tagline: { contains: q } },
      { bio: { contains: q } },
      { location: { contains: q } },
    ],
  };
}

/**
 * One page of community members for the given tab/search, ordered newest-first.
 * Excludes the caller (their own card is rendered separately) and banned users.
 * `total` is the filtered count, for the grid's "showing X of Y".
 */
export async function listMembers({
  currentUserId,
  search,
  tab = "all",
  limit = 24,
  offset = 0,
}: ListMembersOptions): Promise<{ members: MemberDTO[]; total: number }> {
  if (tab === "connections") {
    return listConnectionMembers(currentUserId, search, limit, offset);
  }

  const db = await getPrisma();
  const tenantId = await getTenantId();
  const where: Record<string, unknown> = {
    isBanned: false,
    id: { not: currentUserId },
    tenantMemberships: { some: { tenantId } }, // members of THIS tenant only
    ...memberSearchFilter(search),
  };

  if (tab === "recent") {
    where.createdAt = { gte: new Date(Date.now() - RECENT_WINDOW_MS) };
  } else if (tab === "online") {
    where.lastSeen = { gt: new Date(Date.now() - ONLINE_WINDOW_MS) };
  } else if (tab === "near-me") {
    const me = await db.user.findUnique({
      where: { id: currentUserId },
      select: { location: true },
    });
    // v1: exact-match location (SQLite equality is case-sensitive).
    if (!me?.location) return { members: [], total: 0 };
    where.location = me.location;
  }

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: memberSelect(tenantId),
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.user.count({ where }),
  ]);

  return { members: rows.map(toMemberDTO), total };
}

// The "connections" tab lists a member's accepted connections. That set is
// small, so we page it in memory after fetching the partner rows in chunks —
// `id IN (...)` must stay under D1's 100-bound-parameter cap.
async function listConnectionMembers(
  currentUserId: string,
  search: string | undefined,
  limit: number,
  offset: number,
): Promise<{ members: MemberDTO[]; total: number }> {
  const db = await getPrisma();
  const tenantId = await getTenantId();
  // Connection is tenant-scoped — getPrisma() injects tenantId, so partners are
  // drawn from THIS tenant's accepted connections only.
  const connections = await db.connection.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: currentUserId }, { receiverId: currentUserId }],
    },
    select: { requesterId: true, receiverId: true },
  });

  const partnerIds = connections.map((c) =>
    c.requesterId === currentUserId ? c.receiverId : c.requesterId,
  );
  if (partnerIds.length === 0) return { members: [], total: 0 };

  const searchFilter = memberSearchFilter(search);
  const rowGroups = await Promise.all(
    chunk(partnerIds, 90).map((ids) =>
      db.user.findMany({
        where: {
          id: { in: ids },
          isBanned: false,
          tenantMemberships: { some: { tenantId } },
          ...searchFilter,
        },
        select: memberSelect(tenantId),
      }),
    ),
  );

  const all = rowGroups.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    members: all.slice(offset, offset + limit).map(toMemberDTO),
    total: all.length,
  };
}

export interface MemberTabCounts {
  recent: number;
  online: number;
  nearMe: number;
}

/**
 * Tab-badge counts for the members directory. Computed once on the initial page
 * load (never on scroll). The "all" count is `listMembers().total` and the
 * "connections" count comes from the caller's connection list, so neither is
 * recomputed here. `location` is the caller's own location (for "near me").
 */
export async function getMemberTabCounts(
  currentUserId: string,
  location?: string | null,
): Promise<MemberTabCounts> {
  const db = await getPrisma();
  const tenantId = await getTenantId();
  const base = {
    isBanned: false,
    id: { not: currentUserId },
    tenantMemberships: { some: { tenantId } },
  };
  const [recent, online, nearMe] = await Promise.all([
    db.user.count({
      where: { ...base, createdAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
    }),
    db.user.count({
      where: { ...base, lastSeen: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    }),
    location ? db.user.count({ where: { ...base, location } }) : Promise.resolve(0),
  ]);
  return { recent, online, nearMe };
}

/**
 * Canonical community member count: non-banned users, including the caller.
 * Shared by the homepage stats and the `/community/members` header so the two
 * surfaces always agree.
 */
export async function getMemberCount(): Promise<number> {
  const db = await getPrisma();
  const tenantId = await getTenantId();
  return db.user.count({ where: { isBanned: false, tenantMemberships: { some: { tenantId } } } });
}

export async function searchUsers(q: string) {
  if (!q || q.length < 1) return [];
  const db = await getPrisma();
  const tenantId = await getTenantId();
  const users = await db.user.findMany({
    where: { name: { contains: q }, tenantMemberships: { some: { tenantId } } },
    select: { id: true, name: true, image: true },
    take: 10,
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name || "Anonymous",
    image: u.image,
  }));
}

export async function getProfile(userId: string) {
  // No email — this is callable by any logged-in user, but only for a member of
  // the current tenant (a non-member id 404s), and the post/comment counts are
  // scoped to this tenant.
  const db = await getPrisma();
  const tenantId = await getTenantId();
  const user = await db.user.findFirst({
    where: { id: userId, tenantMemberships: { some: { tenantId } } },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      location: true,
      tagline: true,
      role: true,
      points: true,
      level: true,
      createdAt: true,
      _count: { select: { posts: { where: { tenantId } }, comments: { where: { tenantId } } } },
    },
  });
  if (!user) throw new ServiceError("not_found", "User not found");
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    bio: user.bio,
    location: user.location,
    tagline: user.tagline,
    role: user.role,
    points: user.points || 0,
    level: user.level || 1,
    createdAt: user.createdAt,
    _count: { posts: user._count.posts, comments: user._count.comments },
  };
}

export interface UpdateProfileInput {
  name?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  github?: string | null;
  image?: string | null;
  coverImage?: string | null;
}

export async function updateProfile(actor: ActorLike, input: UpdateProfileInput) {
  // Profile fields are GLOBAL identity (shared across the user's tenants).
  const db = await getPlatformPrisma();
  const updated = await db.user.update({
    where: { id: actor.id },
    data: {
      name: input.name || null,
      bio: input.bio || null,
      location: input.location || null,
      website: input.website || null,
      twitter: input.twitter || null,
      linkedin: input.linkedin || null,
      github: input.github || null,
      image: input.image || null,
      coverImage: input.coverImage || null,
    },
  });
  return {
    id: updated.id,
    name: updated.name,
    bio: updated.bio,
    location: updated.location,
    website: updated.website,
    twitter: updated.twitter,
    linkedin: updated.linkedin,
    github: updated.github,
  };
}

export async function updateTagline(actor: ActorLike, targetId: string, tagline: unknown) {
  if (actor.id !== targetId) {
    throw new ServiceError("forbidden", "You can only update your own tagline");
  }
  if (tagline !== undefined && tagline !== null) {
    if (typeof tagline !== "string") {
      throw new ServiceError("bad_request", "Tagline must be a string");
    }
    if (tagline.length > 60) {
      throw new ServiceError("bad_request", "Tagline must be 60 characters or less");
    }
  }
  const clean = (typeof tagline === "string" ? tagline.trim() : "") || null;
  const db = await getPlatformPrisma(); // tagline is a global User field
  const updated = await db.user.update({
    where: { id: targetId },
    data: { tagline: clean },
    select: { id: true, tagline: true },
  });
  return { success: true, tagline: updated.tagline };
}

export async function setRole(actor: ActorLike, targetId: string, role: string) {
  // Delegates to the roles service: validates role exists, syncs Clerk,
  // updates D1, and enforces the "don't lock yourself out" guard.
  return assignRoleToUser(actor, targetId, role);
}

export async function setBanned(
  actor: ActorLike,
  targetId: string,
  banned: boolean,
  reason?: string | null,
) {
  ensurePermission(actor, "users.edit");

  const db = await getPrisma();
  const tenantId = await getTenantId();
  if (banned) {
    if (actor.id === targetId) {
      throw new ServiceError("bad_request", "You cannot ban yourself");
    }
    // Only a member of the actor's OWN tenant is bannable here — a tenant admin
    // must not reach a user who only belongs to other tenants (the ban flag is
    // global, so the gate is the membership join, not the row).
    const target = await db.user.findFirst({
      where: { id: targetId, tenantMemberships: { some: { tenantId } } },
      select: { id: true },
    });
    if (!target) {
      throw new ServiceError("not_found", "User not found");
    }
    // Refuse to ban anyone whose role grants role-assignment power — those
    // are the people we definitely don't want a single admin able to lock out.
    // Per-tenant: the target's membership role in THIS tenant, not their global
    // User.role (matches the actor's own per-tenant authority).
    const { permissions: targetPerms } = await getActorPermissions(targetId);
    if (hasPermission({ permissions: targetPerms }, "users.assign_role")) {
      throw new ServiceError(
        "bad_request",
        "Cannot ban a user with role-assignment permission. Demote them first.",
      );
    }
  }

  const updated = await db.user.update({
    where: { id: targetId },
    data: banned
      ? { isBanned: true, banReason: reason || null, bannedAt: new Date() }
      : { isBanned: false, banReason: null, bannedAt: null },
    select: { id: true, name: true, isBanned: true },
  });
  return updated;
}

export async function listAllAdmin(actor: ActorLike) {
  ensurePermission(actor, "users.view");
  const db = await getPrisma();
  const tenantId = await getTenantId();
  return db.user.findMany({
    where: { tenantMemberships: { some: { tenantId } } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isBanned: true,
      banReason: true,
      bannedAt: true,
      createdAt: true,
      _count: { select: { posts: { where: { tenantId } }, comments: { where: { tenantId } } } },
      userBadges: {
        where: { tenantId },
        include: {
          badge: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listNamesAdmin(actor: ActorLike) {
  ensurePermission(actor, "users.view");
  const db = await getPrisma();
  const tenantId = await getTenantId();
  const users = await db.user.findMany({
    where: { tenantMemberships: { some: { tenantId } } },
    select: { id: true, name: true, image: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    ...u,
    image: u.image && !u.image.startsWith("data:") ? u.image : null,
  }));
}

const EMAIL_DEFAULTS = {
  mentions: true,
  replies: true,
  likes: false,
  messages: true,
  weeklyDigest: true,
  eventReminders: true,
};

export async function getEmailPreferences(actor: ActorLike) {
  // EmailPreference is 1:1-with-User (globally unique by userId) — treat as
  // global-per-user, not tenant-scoped (spec § open: per-tenant prefs TBD).
  const db = await getPlatformPrisma();
  const prefs = await db.emailPreference.findUnique({
    where: { userId: actor.id },
  });
  if (!prefs) return EMAIL_DEFAULTS;
  return {
    mentions: prefs.mentions,
    replies: prefs.replies,
    likes: prefs.likes,
    messages: prefs.messages,
    weeklyDigest: prefs.weeklyDigest,
    eventReminders: prefs.eventReminders,
  };
}

export interface EmailPreferencesInput {
  mentions?: boolean;
  replies?: boolean;
  likes?: boolean;
  messages?: boolean;
  weeklyDigest?: boolean;
  eventReminders?: boolean;
}

export async function updateEmailPreferences(actor: ActorLike, input: EmailPreferencesInput) {
  const db = await getPlatformPrisma();
  return db.emailPreference.upsert({
    where: { userId: actor.id },
    create: {
      userId: actor.id,
      mentions: input.mentions ?? true,
      replies: input.replies ?? true,
      likes: input.likes ?? false,
      messages: input.messages ?? true,
      weeklyDigest: input.weeklyDigest ?? true,
      eventReminders: input.eventReminders ?? true,
    },
    update: {
      mentions: input.mentions,
      replies: input.replies,
      likes: input.likes,
      messages: input.messages,
      weeklyDigest: input.weeklyDigest,
      eventReminders: input.eventReminders,
    },
  });
}

export async function updateLastSeen(actor: ActorLike) {
  const db = await getPlatformPrisma(); // lastSeen is a global presence field
  await db.user.update({
    where: { id: actor.id },
    data: { lastSeen: new Date() },
  });
  return { success: true };
}

export async function getOnlineUserIds() {
  // Presence (lastSeen) is global; this returns globally-online user ids, which
  // callers intersect with their own tenant's member set.
  const db = await getPlatformPrisma();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsers = await db.user.findMany({
    where: { lastSeen: { gt: fiveMinutesAgo } },
    select: { id: true },
  });
  return onlineUsers.map((u) => u.id);
}

export async function getOnboardingStatus(actor: ActorLike) {
  const db = await getPlatformPrisma(); // isOnboarded is a global User field
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { isOnboarded: true },
  });
  return { isOnboarded: Boolean(user?.isOnboarded) };
}

export async function completeOnboarding(actor: {
  id: string;
  role: string;
  email?: string | null;
  name?: string | null;
}) {
  const db = await getPlatformPrisma(); // isOnboarded is a global User field
  await db.user.update({
    where: { id: actor.id },
    data: { isOnboarded: true },
  });

  await recordActivity({ userId: actor.id, type: "user_joined" });

  if (actor.email) {
    const html = getWelcomeEmailHtml(actor.name || "there", await getTenantConfig());
    sendEmail({
      to: actor.email,
      subject: "Welcome to Claude Code Community!",
      html,
    }).catch((e) => console.error("Failed to send welcome email:", e));
  }

  return { success: true };
}

/**
 * Thin wrapper over `ensureUserInDb()` for callers that want to express
 * "make sure this Clerk user is mirrored locally" through the service layer.
 */
export async function syncFromClerk() {
  return ensureUserInDb();
}

/**
 * Resolve a Clerk user ID to an actor (id + role). Used by MCP-side adapters
 * (e.g. /api/upload/mcp) that have a Clerk OAuth token but no Next.js session.
 * Returns `null` if no DB user is linked to that Clerk ID.
 */
export async function getActorByClerkId(clerkId: string) {
  // Global identity resolution (no tenant needed — runs before tenant scope is
  // established, e.g. /api/upload/mcp).
  const db = await getPlatformPrisma();
  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
}

/**
 * Full user record by Clerk ID. Used by MCP tools whose response shape
 * exposes the caller's profile fields.
 */
export async function getUserByClerkId(clerkId: string) {
  const db = await getPlatformPrisma();
  return db.user.findUnique({ where: { clerkId } });
}
