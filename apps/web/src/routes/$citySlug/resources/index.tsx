import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { listPublishedPages } from "@/modules/pages/services/pagesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, ItemList, PageHeader } from "@/shared/ui/page";

const RESOURCES_PREFIX = "resources/";
const FOR_PREFIX = "for/";

function publicHref(citySlug: string, slug: string): string {
  if (slug.startsWith(RESOURCES_PREFIX)) {
    return `/${citySlug}/resources/${slug.slice(RESOURCES_PREFIX.length)}`;
  }
  if (slug.startsWith(FOR_PREFIX)) {
    return `/${citySlug}/for/${slug.slice(FOR_PREFIX.length)}`;
  }
  return `/${citySlug}/p/${slug}`;
}

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { items: [] as { href: string; id: string; title: string }[] };
    }
    const listed = await listPublishedPages(page.store);
    if (!listed.ok) {
      return { items: [] as { href: string; id: string; title: string }[] };
    }
    return {
      items: listed.pages.map((item) => ({
        href: publicHref(data.citySlug, item.slug),
        id: item.id,
        title: item.title,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/resources/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  staleTime: 60_000,
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { items } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug/events">
            Browse events
          </Link>
        }
        subtitle="Published guides and CMS pages for this city."
        title="Resources"
      />
      {items.length === 0 ? (
        <EmptyCard>No published resources yet.</EmptyCard>
      ) : (
        <ItemList empty="No published resources." items={items} />
      )}
    </section>
  );
}
