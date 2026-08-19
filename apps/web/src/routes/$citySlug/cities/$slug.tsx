import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCityPublic } from "@/modules/cities/services/citiesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
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

function Page() {
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
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{city.description}</p>
      </div>
    </section>
  );
}
