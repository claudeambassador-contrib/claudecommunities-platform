import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "@/modules/events/services/eventsService";

const getEvents = createServerFn({ method: "GET" })
  .inputValidator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const result = await listEvents(data.citySlug);
    if (!result.ok) return { events: [] as { id: string; title: string; startsAt: Date | null; slug: string }[] };
    return {
      events: result.events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
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
        <Link to="/$citySlug" params={{ citySlug: tenant.slug }} className="btn">
          Back
        </Link>
      </div>
      {events.length === 0 ? (
        <div className="card muted">No published events yet.</div>
      ) : (
        events.map((e) => (
          <article key={e.id} className="card">
            <strong>{e.title}</strong>
            <div className="muted">
              /{e.slug}
              {e.startsAt ? ` · ${new Date(e.startsAt).toLocaleString()}` : ""}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
