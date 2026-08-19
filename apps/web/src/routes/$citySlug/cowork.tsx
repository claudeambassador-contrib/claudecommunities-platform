import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listEvents } from "@/modules/events/services/eventsService";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { ItemList, PageHeader } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        events: [] as { id: string; slug: string; startTime: string | null; title: string }[],
      };
    }
    const listed = await listEvents(page.store);
    return {
      events: listed.ok
        ? listed.events.slice(0, 5).map((event) => ({
            id: event.id,
            slug: event.slug,
            startTime: event.startTime,
            title: event.title,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/cowork")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { events } = Route.useLoaderData();
  const { countryName } = getRegionConfig();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <Link
            className="btn btn-primary"
            params={{ citySlug: tenant.slug }}
            to="/$citySlug/events"
          >
            Browse events
          </Link>
        }
        subtitle={`Collaborative in-person sessions across ${countryName}.`}
        title="Claude Code co-work"
      />
      <div className="card">
        <p className="m-0">
          Bring a laptop and a project. Co-work is focused building time — no talks, no agenda —
          just a room of people shipping with Claude Code.
        </p>
      </div>
      <ItemList
        empty="No published events yet. Check back for the next co-work session."
        items={events.map((event) => ({
          detail: event.startTime ? new Date(event.startTime).toLocaleString() : "Date TBA",
          href: `/${tenant.slug}/events/${event.slug}`,
          id: event.id,
          title: event.title,
        }))}
      />
    </section>
  );
}
