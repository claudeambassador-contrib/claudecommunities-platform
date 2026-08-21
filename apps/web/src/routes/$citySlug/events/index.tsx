import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { listEvents } from "@/modules/events/services/eventsService";
import { loadCityPage } from "@/shared/http/cityPage";

const getEventsInput = z.object({ citySlug: z.string().min(1) });

const getEvents = createServerFn({ method: "GET" })
  .validator((input: unknown) => getEventsInput.parse(input))
  .handler(async ({ data }) => {
    const empty = {
      events: [] as { id: string; title: string; startTime: string | null; slug: string }[],
    };
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return empty;
    }
    const result = await listEvents(page.store);
    if (!result.ok) {
      return empty;
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
  staleTime: 30_000,
  component: EventsPage,
});

function EventsPage(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { events } = Route.useLoaderData();

  return (
    <section className="stack">
      <div className="row justify-between">
        <h2 className="m-0">Events</h2>
        <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug">
          Back
        </Link>
      </div>
      {events.length === 0 ? (
        <div className="card muted">No published events yet.</div>
      ) : (
        events.map((e) => (
          <Link
            className="card block"
            key={e.id}
            params={{ citySlug: tenant.slug, slug: e.slug }}
            to="/$citySlug/events/$slug"
          >
            <strong>{e.title}</strong>
            <div className="muted">
              /{e.slug}
              {e.startTime ? ` · ${new Date(e.startTime).toLocaleString()}` : ""}
            </div>
          </Link>
        ))
      )}
    </section>
  );
}
