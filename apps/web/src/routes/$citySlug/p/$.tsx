import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getPublishedPage } from "@/modules/pages/services/pagesService";
import type { Block } from "@/modules/pages/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { CmsBlocks } from "@/shared/ui/cms-blocks";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && data.slug)) {
      return { cms: null as { blocks: Block[]; title: string } | null, signedIn: false };
    }
    const found = await getPublishedPage(page.store, data.slug);
    if (!(found.ok && found.page)) {
      return { cms: null as { blocks: Block[]; title: string } | null, signedIn: false };
    }
    return {
      cms: { blocks: found.page.blocks, title: found.page.title },
      signedIn: Boolean(page.actor),
    };
  });

export const Route = createFileRoute("/$citySlug/p/$")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params._splat ?? "" } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { cms, signedIn } = Route.useLoaderData();

  if (!cms) {
    return <EmptyCard>Page not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader title={cms.title} />
      {cms.blocks.length === 0 ? (
        <EmptyCard>This page has no published content yet.</EmptyCard>
      ) : (
        <CmsBlocks
          blocks={cms.blocks}
          citySlug={tenant.slug}
          region={getRegionConfig()}
          signedIn={signedIn}
        />
      )}
    </section>
  );
}
