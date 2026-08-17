import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";

const loadCity = createServerFn({ method: "GET" })
  .inputValidator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const result = await resolveCityContext(data.citySlug);
    if (!result.ok) {
      throw redirect({ to: "/" });
    }
    return result.tenant;
  });

export const Route = createFileRoute("/$citySlug")({
  beforeLoad: async ({ params }) => {
    const tenant = await loadCity({ data: { citySlug: params.citySlug } });
    return { tenant };
  },
  component: CityLayout,
});

function CityLayout() {
  const { tenant } = Route.useRouteContext();

  return (
    <div className="shell stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>{tenant.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            City instance · org {tenant.orgId} · binding {tenant.d1Binding}
          </p>
        </div>
        <nav className="row">
          <a href={`/${tenant.slug}/events`}>Events</a>
          <a href={`/${tenant.slug}/community`}>Community</a>
          <a href={`/${tenant.slug}/admin`}>Admin</a>
          <a href="/">Directory</a>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
