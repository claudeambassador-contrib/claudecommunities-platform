import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listEvents } from "@/modules/events/services/eventsService";
import { getHomeSections } from "@/modules/pages/services/pagesService";
import type { Block } from "@/modules/pages/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { CmsBlocks, type HomeEventCard } from "@/shared/ui/cms-blocks";

const loadHomeInput = z.object({ citySlug: z.string().min(1) });

const loadHome = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadHomeInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        blocks: [] as Block[],
        events: [] as HomeEventCard[],
        signedIn: false,
      };
    }
    const [home, events] = await Promise.all([getHomeSections(page.store), listEvents(page.store)]);
    return {
      blocks: home.ok ? home.blocks : [],
      events: events.ok
        ? events.events.slice(0, 5).map((event) => ({
            id: event.id,
            slug: event.slug,
            startTime: event.startTime,
            title: event.title,
          }))
        : [],
      signedIn: Boolean(page.actor),
    };
  });

export const Route = createFileRoute("/$citySlug/")({
  loader: ({ params }) => loadHome({ data: { citySlug: params.citySlug } }),
  staleTime: 60_000,
  component: CityHome,
});

function CityHome(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { blocks, events, signedIn } = Route.useLoaderData();

  return (
    <CmsBlocks
      blocks={blocks}
      citySlug={tenant.slug}
      events={events}
      region={getRegionConfig()}
      signedIn={signedIn}
    />
  );
}
