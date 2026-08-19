import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { hasAnyAdminPermission } from "@/modules/identity/services/sessionService";
import { getOwnProfile } from "@/modules/identity/services/usersService";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { CityHeader, type CityViewer } from "@/shared/ui/city-header";

function selectPathname(state: { location: { pathname: string } }): string {
  return state.location.pathname;
}

const loadCity = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      throw redirect({ to: "/" });
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
});

function CityLayout() {
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
