import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { hasAnyAdminPermission } from "@/modules/identity/services/sessionService";
import type { Permission } from "@/shared/auth/permissions";
import { loadCityPage } from "@/shared/http/cityPage";
import { AdminShell } from "@/shared/ui/admin-shell";
import { type AdminNavItem, cityAdminHref, filterAdminNav } from "@/shared/ui/adminNav";
import { DeniedCard } from "@/shared/ui/page";

const loadAdminNavInput = z.object({ citySlug: z.string().min(1) });

const loadAdminNav = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadAdminNavInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        allowed: false as const,
        cityName: "",
        citySlug: data.citySlug,
        links: [] as AdminNavItem[],
        permissions: [] as Permission[],
      };
    }
    const allowed = hasAnyAdminPermission(page.auth);
    const links = allowed
      ? filterAdminNav(page.auth?.permissions ?? new Set(), Boolean(page.auth?.isSuperAdmin)).map(
          (item) => ({
            href: cityAdminHref(page.tenant.slug, item.href),
            label: item.label,
            section: item.section ?? "",
          }),
        )
      : [];
    return {
      allowed,
      cityName: page.tenant.name,
      citySlug: page.tenant.slug,
      links,
      permissions: allowed ? [...(page.auth?.permissions ?? [])] : [],
    };
  });

export const Route = createFileRoute("/$citySlug/admin")({
  beforeLoad: async ({ params }) => loadAdminNav({ data: { citySlug: params.citySlug } }),
  component: AdminLayout,
});

function AdminLayout(): ReactElement {
  const { citySlug } = Route.useParams();
  const { allowed, cityName, links, permissions } = Route.useRouteContext();

  if (!allowed) {
    return (
      <div className="shell stack">
        <DeniedCard reason="Admin access required." title="Admin" />
        <a href={`/${citySlug}`}>Back to site</a>
      </div>
    );
  }

  return (
    <AdminShell cityName={cityName} citySlug={citySlug} links={links} permissions={permissions}>
      <Outlet />
    </AdminShell>
  );
}
