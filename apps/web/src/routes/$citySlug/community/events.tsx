import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "@/modules/events/services/eventsService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ItemList, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        events: [] as { id: string; slug: string; startTime: string | null; title: string }[],
      };
    }
    const result = await listEvents(page.store);
    return {
      events: result.ok
        ? result.events.map((event) => ({
            id: event.id,
            slug: event.slug,
            startTime: event.startTime,
            title: event.title,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/community/events")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: CommunityEventsPage,
});

function CommunityEventsPage() {
  const { citySlug } = Route.useParams();
  const { events } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader subtitle="Upcoming and past gatherings" title="Events" />
      <ItemList
        empty="No published events yet."
        items={events.map((event) => ({
          detail: event.startTime ? new Date(event.startTime).toLocaleString() : "Date TBA",
          href: `/${citySlug}/events/${event.slug}`,
          id: event.id,
          title: event.title,
        }))}
      />
    </section>
  );
}
