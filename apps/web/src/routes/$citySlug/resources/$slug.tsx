import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { getPublishedPage } from "@/modules/pages/services/pagesService";
import type { PublishedPage } from "@/modules/pages/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

function cmsCopy(page: PublishedPage): { body: string; title: string } {
  const parts: string[] = [];
  for (const block of page.blocks) {
    if (!block.enabled) {
      continue;
    }
    if (block.type === "hero" || block.type === "richText") {
      if (block.heading) {
        parts.push(block.heading);
      }
      if (block.body) {
        parts.push(block.body);
      }
    }
  }
  return { body: parts.join("\n\n"), title: page.title };
}

const loadInput = z.object({ citySlug: z.string().min(1), slug: z.string() });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { cms: null as { body: string; title: string } | null };
    }
    const direct = await getPublishedPage(page.store, data.slug);
    const prefixed =
      direct.ok && direct.page
        ? direct
        : await getPublishedPage(page.store, `resources/${data.slug}`);
    const published = prefixed.ok ? prefixed.page : null;
    return { cms: published ? cmsCopy(published) : null };
  });

export const Route = createFileRoute("/$citySlug/resources/$slug")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { cms } = Route.useLoaderData();

  if (!cms) {
    return (
      <section className="stack">
        <EmptyCard>Resource not found.</EmptyCard>
        <a href={`/${tenant.slug}/resources`}>All resources</a>
      </section>
    );
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn" href={`/${tenant.slug}/resources`}>
              All resources
            </a>
            <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug/events">
              Events
            </Link>
          </div>
        }
        title={cms.title}
      />
      {cms.body ? (
        <div className="card">
          <p className="m-0 whitespace-pre-wrap">{cms.body}</p>
        </div>
      ) : (
        <EmptyCard>This page has no hero or rich-text content yet.</EmptyCard>
      )}
    </section>
  );
}
