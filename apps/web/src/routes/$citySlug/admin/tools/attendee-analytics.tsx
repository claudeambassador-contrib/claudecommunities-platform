import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "@/modules/events/services/eventsService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadAttendeeAnalytics = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, events: [], reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "tools.use");
    if (!perm.ok) {
      return { allowed: false as const, events: [], reason: perm.error.code };
    }
    const listed = await listEvents(page.store, { includeInactive: true });
    return {
      allowed: true as const,
      events: listed.ok
        ? listed.events.map((event) => ({
            id: event.id,
            rsvpCount: event.rsvpCount,
            startTime: event.startTime,
            status: event.status,
            title: event.title,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/admin/tools/attendee-analytics")({
  loader: ({ params }) => loadAttendeeAnalytics({ data: { citySlug: params.citySlug } }),
  component: AttendeeAnalyticsPage,
});

function AttendeeAnalyticsPage() {
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
