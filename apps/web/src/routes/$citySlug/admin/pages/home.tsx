import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { z } from "zod";
import { getHomeSections, saveHomeSections } from "@/modules/pages/services/pagesService";
import type { Block } from "@/modules/pages/types";
import { HomeSectionsEditor } from "@/modules/pages/ui/home-sections-editor";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadHomeInput = z.object({ citySlug: z.string().min(1) });

const loadHome = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadHomeInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "pages.view", async (page) => {
      const home = await getHomeSections(page.store);
      return ok({ blocks: home.ok ? home.blocks : [] });
    }),
  );

const saveHomeInput = z.object({
  blocks: z.custom<Block[]>((value) => Array.isArray(value)),
  citySlug: z.string().min(1),
});

const saveHome = createServerFn({ method: "POST" })
  .validator((input: unknown) => saveHomeInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "pages.edit", (page) =>
      saveHomeSections(page.store, page.actor, data.blocks),
    ),
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
