import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getCityPublic } from "@/modules/cities/services/citiesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1), slug: z.string() });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { city: null };
    }
    const found = await getCityPublic(page.store, data.slug);
    if (!found.ok) {
      return { city: null };
    }
    return {
      city: {
        description: found.city.description,
        name: found.city.name,
        slug: found.city.slug,
        state: found.city.state,
        stateFull: found.city.stateFull,
        timezone: found.city.timezone,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/cities/$slug")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { city } = Route.useLoaderData();

  if (!city) {
    return <EmptyCard>City not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug/events">
            Events
          </Link>
        }
        subtitle={`${city.stateFull} (${city.state}) · ${city.timezone}`}
        title={city.name}
      />
      <div className="card">
        <p className="m-0 whitespace-pre-wrap">{city.description}</p>
      </div>
    </section>
  );
}
