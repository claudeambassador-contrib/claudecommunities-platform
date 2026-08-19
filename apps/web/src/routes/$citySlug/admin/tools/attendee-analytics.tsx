import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listEvents } from "@/modules/events/services/eventsService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadAttendeeAnalyticsInput = z.object({ citySlug: z.string().min(1) });

const loadAttendeeAnalytics = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadAttendeeAnalyticsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "tools.use", async (page) => {
      const listed = await listEvents(page.store, { includeInactive: true });
      return ok({
        events: listed.ok
          ? listed.events.map((event) => ({
              id: event.id,
              rsvpCount: event.rsvpCount,
              startTime: event.startTime,
              status: event.status,
              title: event.title,
            }))
          : [],
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/tools/attendee-analytics")({
  loader: ({ params }) => loadAttendeeAnalytics({ data: { citySlug: params.citySlug } }),
  component: AttendeeAnalyticsPage,
});

function AttendeeAnalyticsPage(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Attendee analytics" />;
  }

  const total = data.events.reduce((sum, event) => sum + event.rsvpCount, 0);

  return (
    <section className="stack">
      <PageHeader
        subtitle={`${total} RSVPs across ${data.events.length} events.`}
        title="Attendee analytics"
      />
      {data.events.length === 0 ? (
        <EmptyCard>No events yet.</EmptyCard>
      ) : (
        <div className="stack">
          {data.events.map((event) => (
            <article className="card" key={event.id}>
              <strong>{event.title}</strong>
              <div className="muted">
                {event.rsvpCount} RSVPs · {event.status}
                {event.startTime ? ` · ${new Date(event.startTime).toLocaleString()}` : ""}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
