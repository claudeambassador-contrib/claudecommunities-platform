import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";

import { listEvents } from "@/modules/events/services/eventsService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadEventsInput = cityInput();

const loadEvents = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadEventsInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const result = await listEvents(page.store, { includeInactive: true });
      if (!result.ok) {
        return result;
      }
      return ok({
        events: result.events.map((event) => ({
          detail: [
            event.status,
            event.startTime ? new Date(event.startTime).toLocaleString() : null,
          ]
            .filter(Boolean)
            .join(" · "),
          href: `/${page.tenant.slug}/events/${event.slug}`,
          id: event.id,
          title: event.title,
        })),
      });
    }, "events.view"),
  );

export const Route = createFileRoute("/$citySlug/admin/events/")({
  loader: ({ params }) => loadEvents({ data: { citySlug: params.citySlug } }),
  component: AdminEventsPage,
});

function AdminEventsPage(): ReactElement {
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
