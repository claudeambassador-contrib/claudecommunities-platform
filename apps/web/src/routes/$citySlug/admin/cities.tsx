import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listCitiesAdmin } from "@/modules/cities/services/citiesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadCities = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listCitiesAdmin(page.store, page.actor);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      cities: result.cities.map((city) => ({
        detail: [city.stateFull, city.timezone].filter(Boolean).join(" · "),
        id: city.id,
        title: city.name,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/cities")({
  loader: ({ params }) => loadCities({ data: { citySlug: params.citySlug } }),
  component: AdminCitiesPage,
});

function AdminCitiesPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Cities" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Cities" />
      <ItemList empty="No cities yet." items={data.cities} />
    </section>
  );
}
