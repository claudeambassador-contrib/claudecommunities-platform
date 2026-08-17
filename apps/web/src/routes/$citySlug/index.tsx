import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "@/modules/events/services/eventsService";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";
import { openTenantStore } from "@/shared/db/env";

const getEvents = createServerFn({ method: "GET" })
  .inputValidator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const city = await resolveCityContext(data.citySlug);
    if (!city.ok) {
      return { events: [] as { id: string; title: string; startTime: string | null }[] };
    }
    const result = await listEvents(openTenantStore(city.tenant));
    if (!result.ok) {
      return { events: [] as { id: string; title: string; startTime: string | null }[] };
    }
    return {
      events: result.events.map((e) => ({ id: e.id, title: e.title, startTime: e.startTime })),
    };
  });

export const Route = createFileRoute("/$citySlug/")({
  loader: ({ params }) => getEvents({ data: { citySlug: params.citySlug } }),
  component: CityHome,
});

function CityHome() {
  const { tenant } = Route.useRouteContext();
  const { events } = Route.useLoaderData();

  return (
    <section className="stack">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Welcome to {tenant.name}</h2>
        <p className="muted">
          This city runs on its own D1 database. Content below is scoped via TenantStore + orgId.
        </p>
        <div className="row">
          <Link
            className="btn btn-primary"
            params={{ citySlug: tenant.slug }}
            to="/$citySlug/events"
          >
            Browse events
          </Link>
          <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug/community">
            Community
          </Link>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Upcoming events</h3>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          events.slice(0, 5).map((e) => (
            <div key={e.id}>
              <strong>{e.title}</strong>
              <div className="muted">
                {e.startTime ? new Date(e.startTime).toLocaleString() : "TBA"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
