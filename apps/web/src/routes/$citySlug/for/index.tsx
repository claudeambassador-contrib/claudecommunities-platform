import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { BUILT_IN_INDUSTRIES } from "@/modules/pages/industries";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { ItemList, PageHeader } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    await loadCityPage(data.citySlug);
    return {};
  });

export const Route = createFileRoute("/$citySlug/for/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  staleTime: 60_000,
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { majorCitiesPhrase, siteName } = getRegionConfig();

  return (
    <section className="stack">
      <PageHeader
        subtitle={`${siteName} — Claude Code applied across ${majorCitiesPhrase}.`}
        title="Claude Code for your industry"
      />
      <div className="card">
        <p className="m-0">
          Each vertical has its own stack and constraints. Pick an industry for use cases and
          community meetups.
        </p>
      </div>
      <ItemList
        empty="No industries listed."
        items={BUILT_IN_INDUSTRIES.map((industry) => ({
          detail: industry.detail,
          href: `/${tenant.slug}/for/${industry.slug}`,
          id: industry.slug,
          title: industry.title,
        }))}
      />
    </section>
  );
}
