import { Link } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";

import type { Permission } from "@/shared/auth/permissions";
import { groupAdminNav } from "@/shared/ui/adminNav";
import type { AdminNavItem } from "@/shared/ui/adminNav";
import { PermissionsProvider } from "@/shared/ui/can";

export interface AdminShellProps {
  children: ReactNode;
  cityName: string;
  citySlug: string;
  links: AdminNavItem[];
  permissions: readonly Permission[];
}

export function AdminShell({
  children,
  cityName,
  citySlug,
  links,
  permissions,
}: AdminShellProps): ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = groupAdminNav(links);
  const city = { citySlug };

  const handleOpenDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <PermissionsProvider permissions={permissions}>
      <div className="admin-app">
        <aside className="admin-sidebar">
          <AdminNavBody cityName={cityName} citySlug={citySlug} groups={groups} />
        </aside>
        {drawerOpen ? (
          <div className="admin-drawer">
            <button
              aria-label="Close admin menu"
              className="admin-drawer-backdrop"
              onClick={handleCloseDrawer}
              type="button"
            />
            <aside className="admin-drawer-panel">
              <AdminNavBody
                cityName={cityName}
                citySlug={citySlug}
                groups={groups}
                onNavigate={handleCloseDrawer}
              />
            </aside>
          </div>
        ) : null}
        <div className="admin-main">
          <header className="admin-topbar">
            <button
              aria-label="Open admin menu"
              className="admin-menu-btn"
              onClick={handleOpenDrawer}
              type="button"
            >
              Menu
            </button>
            <Link className="muted" params={city} to="/$citySlug/community">
              Back to community
            </Link>
          </header>
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </PermissionsProvider>
  );
}

interface AdminNavBodyProps {
  cityName: string;
  citySlug: string;
  groups: ReturnType<typeof groupAdminNav>;
  onNavigate?: () => void;
}

function AdminNavBody({ cityName, citySlug, groups, onNavigate }: AdminNavBodyProps): ReactElement {
  return (
    <div className="admin-nav">
      <div className="admin-nav-brand">
        <strong>Admin</strong>
        <span className="muted">{cityName}</span>
      </div>
      <nav className="admin-nav-list">
        {groups.map((group) => (
          <div className="admin-nav-group" key={group.label}>
            {group.label === "Admin" ? null : (
              <div className="admin-nav-section">{group.label}</div>
            )}
            {group.items.map((item) => (
              <a className="admin-nav-link" href={item.href} key={item.href} onClick={onNavigate}>
                {item.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <Link className="admin-nav-link" params={{ citySlug }} to="/$citySlug/community">
        Community
      </Link>
    </div>
  );
}
