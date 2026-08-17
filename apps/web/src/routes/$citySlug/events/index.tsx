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
      return {
        events: [] as { id: string; title: string; startTime: string | null; slug: string }[],
      };
    }
    const result = await listEvents(openTenantStore(city.tenant));
    if (!result.ok) {
      return {
        events: [] as { id: string; title: string; startTime: string | null; slug: string }[],
      };
    }
    return {
      events: result.events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        slug: e.slug,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/events/")({
  loader: ({ params }) => getEvents({ data: { citySlug: params.citySlug } }),
  component: EventsPage,
});

function EventsPage() {
  const { tenant } = Route.useRouteContext();
  const { events } = Route.useLoaderData();

  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Events</h2>
        <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug">
          Back
        </Link>
      </div>
      {events.length === 0 ? (
        <div className="card muted">No published events yet.</div>
      ) : (
        events.map((e) => (
          <article className="card" key={e.id}>
            <strong>{e.title}</strong>
            <div className="muted">
              /{e.slug}
              {e.startTime ? ` · ${new Date(e.startTime).toLocaleString()}` : ""}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
