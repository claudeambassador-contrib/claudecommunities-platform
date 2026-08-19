import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getEventBySlugOrId, listPublicAgenda } from "@/modules/events/services/eventsService";
import type { AgendaItemType } from "@/modules/events/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

interface AgendaRow {
  description: string | null;
  endTime: string | null;
  id: string;
  startTime: string | null;
  title: string;
  type: AgendaItemType;
}

const getEventPage = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { event: null, agenda: [] as AgendaRow[] };
    }
    const found = await getEventBySlugOrId(page.store, data.slug);
    if (!found.ok) {
      return { event: null, agenda: [] as AgendaRow[] };
    }
    const agenda = await listPublicAgenda(page.store, found.event.id);
    return {
      event: {
        description: found.event.description,
        id: found.event.id,
        location: found.event.location,
        rsvpCount: found.event.rsvpCount,
        slug: found.event.slug,
        startTime: found.event.startTime,
        title: found.event.title,
      },
      agenda: agenda.ok
        ? agenda.items.map((item) => ({
            description: item.description,
            endTime: item.endTime,
            id: item.id,
            startTime: item.startTime,
            title: item.title ?? "Untitled",
            type: item.type,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/events/$slug/")({
  loader: ({ params }) => getEventPage({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: EventDetailPage,
});

function formatSlot(start: string | null, end: string | null): string {
  if (!start) {
    return "Time TBA";
  }
  const from = new Date(start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!end) {
    return from;
  }
  return `${from} – ${new Date(end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function EventDetailPage() {
  const { tenant } = Route.useRouteContext();
  const { event, agenda } = Route.useLoaderData();
  const city = { citySlug: tenant.slug };

  if (!event) {
    return <EmptyCard>Event not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <Link
              className="btn"
              params={{ citySlug: tenant.slug, slug: event.slug }}
              to="/$citySlug/events/$slug/resources"
            >
              Resources
            </Link>
            <Link className="btn" params={city} to="/$citySlug/events">
              All events
            </Link>
          </div>
        }
        subtitle={event.startTime ? new Date(event.startTime).toLocaleString() : "Date TBA"}
        title={event.title}
      />
      <div className="card stack">
        {event.location ? <p className="muted">{event.location}</p> : null}
        <p style={{ whiteSpace: "pre-wrap" }}>{event.description ?? "No description yet."}</p>
        <p className="muted">{event.rsvpCount} RSVPs</p>
      </div>
      <div className="card stack">
        <strong>Agenda</strong>
        {agenda.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Agenda has not been published for this event yet.
          </p>
        ) : (
          agenda.map((item) => (
            <div key={item.id}>
              <div className="muted">
                {formatSlot(item.startTime, item.endTime)} · {item.type}
              </div>
              <strong>{item.title}</strong>
              {item.description ? (
                <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                  {item.description}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
