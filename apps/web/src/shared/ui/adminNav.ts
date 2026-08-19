import type { Permission } from "@/shared/auth/permissions";

export interface AdminNavLink {
  href: string;
  label: string;
  permission: Permission | null;
  section?: string;
}

export const ADMIN_NAV: AdminNavLink[] = [
  { href: "/admin", label: "Dashboard", permission: null },
  { href: "/admin/users", label: "Users", permission: "users.view", section: "Members" },
  { href: "/admin/roles", label: "Roles", permission: "roles.view", section: "Members" },
  { href: "/admin/invite", label: "Invite", permission: "users.invite", section: "Members" },
  { href: "/admin/import", label: "Import", permission: "users.import", section: "Members" },
  { href: "/admin/badges", label: "Badges", permission: "badges.view", section: "Members" },
  { href: "/admin/tiers", label: "Tiers", permission: "tiers.view", section: "Members" },
  { href: "/admin/pages", label: "Pages", permission: "pages.view", section: "Content" },
  { href: "/admin/posts", label: "Posts", permission: "posts.view", section: "Content" },
  { href: "/admin/events", label: "Events", permission: "events.view", section: "Content" },
  { href: "/admin/courses", label: "Courses", permission: "courses.view", section: "Content" },
  { href: "/admin/speakers", label: "Speakers", permission: "speakers.view", section: "Content" },
  { href: "/admin/cities", label: "Cities", permission: "cities.view", section: "Content" },
  { href: "/admin/industries", label: "Industries", permission: "pages.view", section: "Content" },
  { href: "/admin/email", label: "Email", permission: "email.view", section: "Marketing" },
  { href: "/admin/social", label: "Social", permission: "social.view", section: "Marketing" },
  {
    href: "/admin/analytics",
    label: "Analytics",
    permission: "analytics.view",
    section: "Insights",
  },
  { href: "/admin/settings", label: "Settings", permission: "tenant.settings", section: "System" },
  { href: "/admin/tools", label: "Tools", permission: "tools.use", section: "System" },
];

export function cityAdminHref(citySlug: string, href: string): string {
  return `/${citySlug}${href}`;
}

export function filterAdminNav(
  granted: ReadonlySet<Permission>,
  isSuperAdmin: boolean,
): AdminNavLink[] {
  return ADMIN_NAV.filter(
    (item) => item.permission === null || isSuperAdmin || granted.has(item.permission),
  );
}

export interface AdminNavItem {
  href: string;
  label: string;
  section: string;
}

export interface AdminNavGroup {
  items: AdminNavItem[];
  label: string;
}

export function groupAdminNav(links: readonly AdminNavItem[]): AdminNavGroup[] {
  const groups: AdminNavGroup[] = [];
  for (const link of links) {
    const label = link.section || "Admin";
    const last = groups.at(-1);
    if (last && last.label === label) {
      last.items.push(link);
    } else {
      groups.push({ items: [link], label });
    }
  }
  return groups;
}
