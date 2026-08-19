import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "@/modules/events/services/eventsService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadEvents = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "events.view");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    const result = await listEvents(page.store, { includeInactive: true });
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      events: result.events.map((event) => ({
        detail: [event.status, event.startTime ? new Date(event.startTime).toLocaleString() : null]
          .filter(Boolean)
          .join(" · "),
        href: `/${page.tenant.slug}/events/${event.slug}`,
        id: event.id,
        title: event.title,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/events/")({
  loader: ({ params }) => loadEvents({ data: { citySlug: params.citySlug } }),
  component: AdminEventsPage,
});

function AdminEventsPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Events" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/events/new`}>
            New event
          </a>
        }
        title="Events"
      />
      <ItemList empty="No events yet." items={data.events} />
    </section>
  );
}
