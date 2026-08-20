import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import {
  getEventBySlugOrId,
  listPublicAgenda,
  toPublicEventDetail,
} from "@/modules/events/services/eventsService";
import type { AgendaItemDetail } from "@/modules/events/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const getEventPageInput = z.object({ citySlug: z.string().min(1), slug: z.string() });

const getEventPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => getEventPageInput.parse(input))
  .handler(async ({ data }) => {
    const empty = { agenda: [] as AgendaItemDetail[], event: null };
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return empty;
    }
    const found = await getEventBySlugOrId(page.store, data.slug);
    if (!found.ok) {
      return empty;
    }
    const agenda = await listPublicAgenda(page.store, found.event.id);
    // This route is unauthenticated, so the payload must be the public
    // projection: `toPublicEventDetail` drops the private `meetingUrl`.
    return { agenda: agenda.ok ? agenda.items : [], event: toPublicEventDetail(found.event) };
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

function EventDetailPage(): ReactElement {
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
        <p className="whitespace-pre-wrap">{event.description ?? "No description yet."}</p>
        <p className="muted">{event.rsvpCount} RSVPs</p>
      </div>
      <div className="card stack">
        <strong>Agenda</strong>
        {agenda.length === 0 ? (
          <p className="muted m-0">Agenda has not been published for this event yet.</p>
        ) : (
          agenda.map((item) => (
            <div key={item.id}>
              <div className="muted">
                {formatSlot(item.startTime, item.endTime)} · {item.type}
              </div>
              <strong>{item.title ?? "Untitled"}</strong>
              {item.description ? <p className="muted mt-1">{item.description}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
