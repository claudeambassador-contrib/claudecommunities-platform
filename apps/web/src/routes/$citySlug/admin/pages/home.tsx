import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { getHomeSections, saveHomeSections } from "@/modules/pages/services/pagesService";
import type { Block } from "@/modules/pages/types";
import { HomeSectionsEditor } from "@/modules/pages/ui/home-sections-editor";
import { loadCityPage } from "@/shared/http/cityPage";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadHome = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, "pages.view", async (page) => {
      const home = await getHomeSections(page.store);
      return ok({ blocks: home.ok ? home.blocks : [] });
    }),
  );

const saveHome = createServerFn({ method: "POST" })
  .validator((d: { blocks: Block[]; citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await saveHomeSections(page.store, page.actor, data.blocks);
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/pages/home")({
  loader: ({ params }) => loadHome({ data: { citySlug: params.citySlug } }),
  component: HomeCmsPage,
});

function HomeCmsPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();
  const handleSave = useCallback(
    (blocks: Block[]) => saveHome({ data: { blocks, citySlug } }),
    [citySlug],
  );

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Home page" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/pages`}>
            Back
          </a>
        }
        subtitle={`${data.blocks.length} sections`}
        title="Home page"
      />
      <HomeSectionsEditor initialBlocks={data.blocks} onSave={handleSave} />
    </section>
  );
}
