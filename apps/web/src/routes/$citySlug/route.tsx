import { createFileRoute, Link, notFound, Outlet, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { hasAnyAdminPermission } from "@/modules/identity/services/sessionService";
import { getOwnProfile } from "@/modules/identity/services/usersService";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { CityHeader } from "@/shared/ui/city-header";
import type { CityViewer } from "@/shared/ui/city-header";

function selectPathname(state: { location: { pathname: string } }): string {
  return state.location.pathname;
}

const loadCityInput = z.object({ citySlug: z.string().min(1) });

const loadCity = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadCityInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      throw notFound();
    }
    const region = getRegionConfig();
    let viewer: CityViewer | null = null;
    if (page.actor) {
      const profile = await getOwnProfile(page.registry, page.actor);
      viewer = {
        id: page.actor.id,
        imageUrl: profile.ok ? profile.user.imageUrl : null,
        isAdmin: hasAnyAdminPermission(page.auth),
        name: profile.ok
          ? profile.user.displayName?.trim() || profile.user.email
          : (page.actor.email ?? "Member"),
      };
    }
    return {
      countryName: region.countryName,
      merchEnabled: region.merchEnabled,
      tenant: page.tenant,
      viewer,
    };
  });

export const Route = createFileRoute("/$citySlug")({
  beforeLoad: async ({ params }) => loadCity({ data: { citySlug: params.citySlug } }),
  component: CityLayout,
  notFoundComponent: CityNotFound,
});

function CityNotFound(): ReactElement {
  return (
    <main className="shell stack">
      <div className="card stack">
        <h1 className="m-0">City not found</h1>
        <p className="muted m-0">
          This city community does not exist or is not available in this region.
        </p>
        <div className="row">
          <Link className="btn btn-primary" to="/">
            Browse all cities
          </Link>
        </div>
      </div>
    </main>
  );
}

function CityLayout(): ReactElement {
  const { countryName, merchEnabled, tenant, viewer } = Route.useRouteContext();
  const pathname = useRouterState({ select: selectPathname });
  const isCityAdmin = pathname.startsWith(`/${tenant.slug}/admin`);

  if (isCityAdmin) {
    return <Outlet />;
  }

  return (
    <div>
      <CityHeader
        cityName={tenant.name}
        citySlug={tenant.slug}
        countryName={countryName}
        merchEnabled={merchEnabled}
        viewer={viewer}
      />
      <div className="shell stack">
        <Outlet />
      </div>
    </div>
  );
}
