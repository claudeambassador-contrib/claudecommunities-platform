import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listCitiesAdmin } from "@/modules/cities/services/citiesService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadCitiesInput = z.object({ citySlug: z.string().min(1) });

const loadCities = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadCitiesInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "cities.view", async (page) => {
      const result = await listCitiesAdmin(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        cities: result.cities.map((city) => ({
          detail: [city.stateFull, city.timezone].filter(Boolean).join(" · "),
          id: city.id,
          title: city.name,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/cities")({
  loader: ({ params }) => loadCities({ data: { citySlug: params.citySlug } }),
  component: AdminCitiesPage,
});

function AdminCitiesPage(): ReactElement {
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
