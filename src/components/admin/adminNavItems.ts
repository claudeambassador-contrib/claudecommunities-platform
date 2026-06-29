import {
  Award,
  BarChart3,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  Contact,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LayoutTemplate,
  type LucideIcon,
  Mail,
  MapPin,
  Megaphone,
  Mic,
  PieChart,
  Presentation,
  QrCode,
  Send,
  Settings,
  Shield,
  Upload,
  UserPlus,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Permission required to see this nav item. If `null`, the item is shown
   * to any user with at least one admin permission (used for the Dashboard
   * landing page).
   */
  permission: Permission | null;
  /**
   * Short blurb shown on the admin dashboard cards. Top-level items carry one;
   * children don't (they aren't surfaced as dashboard cards).
   */
  description?: string;
  /**
   * Top-level grouping label, rendered as a static (non-clickable) section
   * header in the sidebar. `undefined` means no header — used for the
   * Dashboard landing item pinned at the top. Items sharing a section are
   * assumed to be contiguous in the array.
   */
  section?: string;
  children?: AdminNavItem[];
}

export const adminNavItems: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, permission: null },

  // Members
  {
    label: "Users",
    description: "View, edit, and manage user accounts",
    href: "/admin/users",
    icon: Users,
    permission: "users.view",
    section: "Members",
  },
  {
    label: "Roles",
    description: "Define roles and assign permissions",
    href: "/admin/roles",
    icon: Shield,
    permission: "roles.view",
    section: "Members",
  },
  {
    label: "Invite",
    description: "Manually add and invite new members",
    href: "/admin/invite",
    icon: UserPlus,
    permission: "users.invite",
    section: "Members",
  },
  {
    label: "Import",
    description: "Import users from Luma or CSV files",
    href: "/admin/import",
    icon: Upload,
    permission: "users.import",
    section: "Members",
  },
  {
    label: "Badges",
    description: "Create and assign badges to members",
    href: "/admin/badges",
    icon: Award,
    permission: "badges.view",
    section: "Members",
  },
  {
    label: "Tiers",
    description: "Configure pricing and membership plans",
    href: "/admin/tiers",
    icon: CreditCard,
    permission: "tiers.view",
    section: "Members",
  },

  // Content
  {
    label: "Pages",
    description: "Edit your home page and create custom pages",
    href: "/admin/pages",
    icon: LayoutTemplate,
    permission: "pages.view",
    section: "Content",
  },
  {
    label: "Posts",
    description: "Review and moderate community content",
    href: "/admin/posts",
    icon: FileText,
    permission: "posts.view",
    section: "Content",
  },
  {
    label: "Events",
    description: "Create and manage community events",
    href: "/admin/events",
    icon: Calendar,
    permission: "events.view",
    section: "Content",
  },
  {
    label: "Courses",
    description: "Create and manage learning content",
    href: "/admin/courses",
    icon: GraduationCap,
    permission: "courses.view",
    section: "Content",
  },
  {
    label: "Speakers",
    description: "Review and manage speaker applications",
    href: "/admin/speakers",
    icon: Mic,
    permission: "speakers.view",
    section: "Content",
  },
  {
    label: "Cities",
    description: "Manage the cities and regions in your footer & city pages",
    href: "/admin/cities",
    icon: MapPin,
    permission: "cities.view",
    section: "Content",
  },
  {
    label: "Industries",
    description: "Edit the /for industry landing pages",
    href: "/admin/industries",
    icon: Building2,
    permission: "pages.view",
    section: "Content",
  },

  // Marketing
  {
    label: "Email",
    description: "Send email campaigns to your community",
    href: "/admin/email",
    icon: Mail,
    permission: "email.view",
    section: "Marketing",
    children: [
      { label: "Campaigns", href: "/admin/email", icon: Send, permission: "email.view" },
      {
        label: "Contacts",
        href: "/admin/email/contacts",
        icon: Contact,
        permission: "email.view",
      },
      {
        label: "Templates",
        href: "/admin/email/templates",
        icon: LayoutTemplate,
        permission: "email.view",
      },
      {
        label: "Automations",
        href: "/admin/email/automations",
        icon: Workflow,
        permission: "email.view",
      },
      {
        label: "Analytics",
        href: "/admin/email/analytics",
        icon: BarChart3,
        permission: "email.view",
      },
      {
        label: "Settings",
        href: "/admin/email/settings",
        icon: Settings,
        permission: "email.settings",
      },
    ],
  },
  {
    label: "Social",
    description: "Schedule and publish LinkedIn posts",
    href: "/admin/social",
    icon: Megaphone,
    permission: "social.view",
    section: "Marketing",
    children: [
      {
        label: "Scheduler",
        href: "/admin/social",
        icon: CalendarDays,
        permission: "social.view",
      },
      {
        label: "Accounts",
        href: "/admin/social/settings",
        icon: Settings,
        permission: "social.manage",
      },
    ],
  },
  // Insights
  {
    label: "Analytics",
    description: "View community metrics and insights",
    href: "/admin/analytics",
    icon: BarChart3,
    permission: "analytics.view",
    section: "Insights",
  },

  // System
  {
    label: "Tenant settings",
    description: "Edit this community's branding, links, and config",
    href: "/admin/settings",
    icon: Settings,
    permission: "tenant.settings",
    section: "System",
  },
  {
    label: "Tools",
    description: "Attendee analytics and event utilities",
    href: "/admin/tools",
    icon: Wrench,
    permission: "tools.use",
    section: "System",
    children: [
      {
        label: "Attendee Analytics",
        href: "/admin/tools/attendee-analytics",
        icon: PieChart,
        permission: "tools.use",
      },
      {
        label: "QR Generator",
        href: "/admin/tools/qr-generator",
        icon: QrCode,
        permission: "tools.use",
      },
      {
        label: "Attendance Planner",
        href: "/admin/tools/attendance-planner",
        icon: ClipboardList,
        permission: "tools.use",
      },
      {
        label: "Speaker Slide Generator",
        href: "/admin/tools/slide-generator",
        icon: Presentation,
        permission: "tools.use",
      },
    ],
  },
];

/**
 * Filter the nav tree to items the actor can see. Group items (with
 * children) survive if either their own permission is granted OR they have
 * at least one visible child.
 */
export function filterNavForPermissions(
  items: AdminNavItem[],
  granted: ReadonlySet<Permission>,
): AdminNavItem[] {
  return items
    .map((item): AdminNavItem | null => {
      const visibleChildren = item.children
        ? filterNavForPermissions(item.children, granted)
        : undefined;
      const selfAllowed = item.permission === null || granted.has(item.permission);
      if (!selfAllowed && (!visibleChildren || visibleChildren.length === 0)) {
        return null;
      }
      if (item.children) {
        return { ...item, children: visibleChildren };
      }
      return item;
    })
    .filter((x): x is AdminNavItem => x !== null);
}
