import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "@/modules/events/services/eventsService";

const getEvents = createServerFn({ method: "GET" })
  .inputValidator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const result = await listEvents(data.citySlug);
    if (!result.ok) return { events: [] as Awaited<ReturnType<typeof listEvents>> extends { ok: true; events: infer E } ? E : never };
    return { events: result.events };
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
          <Link to="/$citySlug/events" params={{ citySlug: tenant.slug }} className="btn btn-primary">
            Browse events
          </Link>
          <Link to="/$citySlug/community" params={{ citySlug: tenant.slug }} className="btn">
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
              <div className="muted">{e.startsAt ? new Date(e.startsAt).toLocaleString() : "TBA"}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
