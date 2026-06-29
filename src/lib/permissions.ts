/**
 * Permission registry + role lookup.
 *
 * The permission set is a hardcoded, type-safe enum (the `Permission` union).
 * Roles are stored in the `Role` table; each row carries a JSON-encoded array
 * of these strings. A user's assigned role name lives in two places:
 *
 *   - Clerk `publicMetadata.role` — the cross-system source of truth
 *   - D1 `User.role`              — a mirror, used for fast checks here
 *
 * Edits to `publicMetadata.role` made directly in the Clerk dashboard will
 * not sync back to D1; always change roles through `setUserRole` in
 * src/lib/clerk-roles.ts.
 */
import { getPrisma, type ScopedClient } from "@/lib/prisma";

export const PERMISSIONS = {
  // Users (incl. import / invite / sync utilities)
  "users.view": "View users",
  "users.edit": "Edit users (ban, unban, edit profile)",
  "users.delete": "Delete users",
  "users.assign_role": "Assign roles to users",
  "users.import": "Bulk import users (CSV)",
  "users.invite": "Invite individual users",
  "users.sync": "Sync user data from Clerk",

  // Posts
  "posts.view": "View posts (admin)",
  "posts.edit": "Edit posts",
  "posts.delete": "Delete posts",

  // Badges
  "badges.view": "View badges",
  "badges.edit": "Create / edit badges",
  "badges.delete": "Delete badges",

  // Courses
  "courses.view": "View courses (admin)",
  "courses.edit": "Create / edit courses",
  "courses.delete": "Delete courses",

  // Events
  "events.view": "View events (admin)",
  "events.edit": "Create / edit events",
  "events.delete": "Delete events",

  // Email
  "email.view": "View email dashboard",
  "email.edit": "Create / edit campaigns, templates, contacts",
  "email.send": "Send email campaigns",
  "email.delete": "Delete email assets",
  "email.settings": "Manage email settings",

  // Tiers
  "tiers.view": "View tiers",
  "tiers.edit": "Create / edit tiers",
  "tiers.delete": "Delete tiers",

  // Speakers
  "speakers.view": "View speakers",
  "speakers.edit": "Create / edit speakers",
  "speakers.delete": "Delete speakers",

  // Analytics
  "analytics.view": "View analytics",

  // Admin tools (QR generator, attendance planner, slide generator, etc.)
  "tools.use": "Access admin tools",

  // Social (scheduler + connected accounts)
  "social.view": "View social posts and scheduler",
  "social.edit": "Create / edit / schedule / delete social posts",
  "social.publish": "Publish social posts immediately",
  "social.manage": "Connect / disconnect social accounts",

  // Roles (the meta permission — anyone with roles.edit can grant any
  // permission to any role, including their own. Guard accordingly.)
  "roles.view": "View roles",
  "roles.edit": "Create / edit roles",
  "roles.delete": "Delete roles",

  // Community settings — edit this tenant's own branding/config (name, hero
  // image, Discord/LinkedIn, cities, copy, email, GA, custom domain). This is a
  // per-tenant power (a tenant admin editing THEIR community), distinct from the
  // platform console that provisions tenants across the whole platform.
  "tenant.settings": "Edit community settings",

  // Content pages (home page CMS + tenant-authored pages — Page table)
  "pages.view": "View page content (admin)",
  "pages.edit": "Edit page content (home page + custom pages)",

  // Cities (per-tenant city catalog)
  "cities.view": "View cities",
  "cities.edit": "Create / edit / delete cities",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS: readonly Permission[] = Object.keys(PERMISSIONS) as Permission[];

/** Grouped view of the registry — used by the admin UI to render checkboxes. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Users",
    permissions: [
      "users.view",
      "users.edit",
      "users.delete",
      "users.assign_role",
      "users.import",
      "users.invite",
      "users.sync",
    ],
  },
  { label: "Posts", permissions: ["posts.view", "posts.edit", "posts.delete"] },
  { label: "Badges", permissions: ["badges.view", "badges.edit", "badges.delete"] },
  { label: "Courses", permissions: ["courses.view", "courses.edit", "courses.delete"] },
  { label: "Events", permissions: ["events.view", "events.edit", "events.delete"] },
  {
    label: "Email",
    permissions: ["email.view", "email.edit", "email.send", "email.delete", "email.settings"],
  },
  { label: "Tiers", permissions: ["tiers.view", "tiers.edit", "tiers.delete"] },
  { label: "Speakers", permissions: ["speakers.view", "speakers.edit", "speakers.delete"] },
  { label: "Analytics", permissions: ["analytics.view"] },
  { label: "Tools", permissions: ["tools.use"] },
  {
    label: "Social",
    permissions: ["social.view", "social.edit", "social.publish", "social.manage"],
  },
  { label: "Roles", permissions: ["roles.view", "roles.edit", "roles.delete"] },
  { label: "Community", permissions: ["tenant.settings"] },
  { label: "Content pages", permissions: ["pages.view", "pages.edit"] },
  { label: "Cities", permissions: ["cities.view", "cities.edit"] },
];

export const SYSTEM_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

/** Parse the JSON-encoded permission array stored on a Role row. */
export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is Permission => typeof p === "string" && p in PERMISSIONS);
  } catch {
    return [];
  }
}

// NOTE: a `getRolePermissions(roleName)` helper used to live here. It was
// removed deliberately — taking a bare role NAME made it trivial to pass the
// global `User.role` and re-introduce the cross-tenant privilege escalation
// this module now prevents. Resolve permissions from the USER via
// getActorPermissions / getMembershipPermissions, which read the URL-tenant
// UserTenant membership.

/**
 * Resolve a user's effective permissions for the CURRENT tenant from their
 * `UserTenant` MEMBERSHIP role — NOT the global `User.role`. This is the
 * privilege-escalation fix: a globally-"admin" user who is only a member of
 * this tenant gets member permissions here, and a non-member gets none.
 *
 * `db` MUST be the tenant-scoped client (`getPrisma()`), so both the membership
 * and role lookups are bound to the URL tenant. Fail-closed: no membership ⇒
 * `{ role: null, permissions: [] }`.
 */
export async function getMembershipPermissions(
  db: ScopedClient,
  userId: string,
): Promise<{ role: string | null; permissions: Permission[] }> {
  // Platform operator: a GLOBAL super_admin (`User.role`) administers EVERY
  // tenant, even one they aren't a member of — matching the platform console
  // (`(platform)/admin`), which gates on this same global role. This is the ONLY
  // place the global role grants per-tenant power; every other role resolves
  // from the `UserTenant` membership below (the cross-tenant anti-escalation
  // rule). This grants PERMISSION only — data still flows through the
  // tenant-scoped `getPrisma()`, so the operator acts on the URL tenant's own
  // rows, never across tenants. `User` is a global model, readable on the scoped
  // client without a tenant filter.
  const identity = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (identity?.role === SYSTEM_ROLES.SUPER_ADMIN) {
    return { role: SYSTEM_ROLES.SUPER_ADMIN, permissions: [...ALL_PERMISSIONS] };
  }

  const membership = await db.userTenant.findFirst({ where: { userId }, select: { role: true } });
  if (!membership) return { role: null, permissions: [] };
  // A tenant's OWN super_admin (membership role, not global) is the locked
  // "rescue" role: its permissions are non-editable (see updateRole) so it
  // ALWAYS holds the full set. Resolve it to the live registry rather than the
  // Role row's stored snapshot, so a permission added to PERMISSIONS after the
  // tenant was provisioned (e.g. pages.*) is granted without a data backfill.
  // Other roles use their stored grants.
  if (membership.role === SYSTEM_ROLES.SUPER_ADMIN) {
    return { role: membership.role, permissions: [...ALL_PERMISSIONS] };
  }
  const role = await db.role.findFirst({ where: { name: membership.role } });
  return { role: membership.role, permissions: parsePermissions(role?.permissions) };
}

/**
 * {@link getMembershipPermissions} for the current request/ALS tenant, resolving
 * the scoped client itself. The membership-based permission resolver used at
 * every server-side authz site (it takes the USER, not a role name).
 */
export async function getActorPermissions(
  userId: string,
): Promise<{ role: string | null; permissions: Permission[] }> {
  const db = await getPrisma();
  return getMembershipPermissions(db, userId);
}

/** Synchronous check against an already-resolved permission set. */
export function hasPermission(
  actor: { permissions?: readonly Permission[] | null } | null | undefined,
  permission: Permission,
): boolean {
  if (!actor?.permissions) return false;
  return actor.permissions.includes(permission);
}

export function hasAnyAdminPermission(
  actor: { permissions?: readonly Permission[] | null } | null | undefined,
): boolean {
  if (!actor?.permissions) return false;
  return actor.permissions.length > 0;
}
