/**
 * Permission registry — ported from the Next app.
 * Authz role is PER-CITY on user_memberships, never on the global user.
 */
export const PERMISSIONS = {
  "analytics.view": "View analytics",
  "badges.delete": "Delete badges",
  "badges.edit": "Create / edit badges",
  "badges.view": "View badges",
  "cities.edit": "Create / edit / delete cities",
  "cities.view": "View cities",
  "courses.delete": "Delete courses",
  "courses.edit": "Create / edit courses",
  "courses.view": "View courses (admin)",
  "email.delete": "Delete email assets",
  "email.edit": "Create / edit campaigns, templates, contacts",
  "email.send": "Send email campaigns",
  "email.settings": "Manage email settings",
  "email.view": "View email dashboard",
  "events.delete": "Delete events",
  "events.edit": "Create / edit events",
  "events.view": "View events (admin)",
  "pages.edit": "Edit page content (home page + custom pages)",
  "pages.view": "View page content (admin)",
  "posts.delete": "Delete posts",
  "posts.edit": "Edit posts",
  "posts.view": "View posts (admin)",
  "roles.delete": "Delete roles",
  "roles.edit": "Create / edit roles",
  "roles.view": "View roles",
  "social.edit": "Create / edit / schedule / delete social posts",
  "social.manage": "Connect / disconnect social accounts",
  "social.publish": "Publish social posts immediately",
  "social.view": "View social posts and scheduler",
  "speakers.delete": "Delete speakers",
  "speakers.edit": "Create / edit speakers",
  "speakers.view": "View speakers",
  "tenant.settings": "Edit community settings",
  "tiers.delete": "Delete tiers",
  "tiers.edit": "Create / edit tiers",
  "tiers.view": "View tiers",
  "tools.use": "Access admin tools",
  "users.assign_role": "Assign roles to users",
  "users.delete": "Delete users",
  "users.edit": "Edit users (ban, unban, edit profile)",
  "users.import": "Bulk import users (CSV)",
  "users.invite": "Invite individual users",
  "users.sync": "Sync user data from Clerk",
  "users.view": "View users",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS: readonly Permission[] = Object.keys(PERMISSIONS) as Permission[];

const OWNER_PERMS = new Set(ALL_PERMISSIONS);
const ADMIN_PERMS = new Set(
  ALL_PERMISSIONS.filter((p) => !p.startsWith("roles.") || p === "roles.view"),
);
const MEMBER_PERMS = new Set<Permission>();

export function permissionsForRole(
  role: "owner" | "admin" | "member" | null | undefined,
): ReadonlySet<Permission> {
  if (role === "owner") {
    return OWNER_PERMS;
  }
  if (role === "admin") {
    return ADMIN_PERMS;
  }
  return MEMBER_PERMS;
}

export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is Permission => typeof item === "string" && item in PERMISSIONS,
    );
  } catch {
    return [];
  }
}

export function hasPermission(
  permissions: ReadonlySet<Permission>,
  permission: Permission | Permission[],
): boolean {
  const needed = Array.isArray(permission) ? permission : [permission];
  return needed.every((p) => permissions.has(p));
}
