import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { z } from "zod";
import { getHomeSections, saveHomeSections } from "@/modules/pages/services/pagesService";
import type { Block } from "@/modules/pages/types";
import { HomeSectionsEditor } from "@/modules/pages/ui/home-sections-editor";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadHomeInput = cityInput();

const loadHome = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadHomeInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const home = await getHomeSections(page.store);
      return ok({ blocks: home.ok ? home.blocks : [] });
    }, "pages.view"),
  );

const saveHomeInput = cityInput({
  blocks: z.custom<Block[]>((value) => Array.isArray(value)),
});

const saveHome = createServerFn({ method: "POST" })
  .validator((input: unknown) => saveHomeInput.parse(input))
  .handler(
    cityMutationHandler((page, data) => saveHomeSections(page.store, page.actor, data.blocks)),
  );

export const Route = createFileRoute("/$citySlug/admin/pages/home")({
  loader: ({ params }) => loadHome({ data: { citySlug: params.citySlug } }),
  component: HomeCmsPage,
});

function HomeCmsPage(): ReactElement {
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
