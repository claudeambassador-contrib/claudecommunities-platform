import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listEvents } from "@/modules/events/services/eventsService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadEventsInput = z.object({ citySlug: z.string().min(1) });

const loadEvents = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadEventsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "events.view", async (page) => {
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
    }),
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
