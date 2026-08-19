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

export const Route = createFileRoute("/$citySlug/professionals")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { events } = Route.useLoaderData();
  const { countryName } = getRegionConfig();
  const city = { citySlug: tenant.slug };

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <Link className="btn btn-primary" params={city} to="/$citySlug/events">
              Browse events
            </Link>
            <Link className="btn" params={city} to="/$citySlug/community">
              Community
            </Link>
          </div>
        }
        subtitle={`Meetups for professional engineers across ${countryName}.`}
        title="For professionals"
      />
      <div className="card">
        <p className="m-0">
          Practical sessions for engineers using Claude Code in production — workflows, reviews,
          architecture, and how teams actually adopt AI-assisted development.
        </p>
      </div>
      <ItemList
        empty="No published events yet. Join the community to hear about the next meetup."
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
