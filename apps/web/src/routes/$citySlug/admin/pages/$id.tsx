import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getContentPage } from "@/modules/pages/services/pagesService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadPageInput = cityInput({ id: z.string() });

const loadPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadPageInput.parse(input))
  .handler(
    cityHandler(async (page, data) => {
      const result = await getContentPage(page.store, page.actor, data.id);
      if (!result.ok) {
        return result;
      }
      return ok({
        page: {
          blockCount: result.page.blocks.length,
          id: result.page.id,
          slug: result.page.slug,
          status: result.page.status,
          title: result.page.title,
        },
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/pages/$id")({
  loader: ({ params }) => loadPage({ data: { citySlug: params.citySlug, id: params.id } }),
  component: ContentPageDetail,
});

function ContentPageDetail(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Page" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/pages`}>
            Back
          </a>
        }
        subtitle={`/${data.page.slug} · ${data.page.status}`}
        title={data.page.title}
      />
      <div className="card">
        <p className="muted m-0">{data.page.blockCount} sections</p>
      </div>
    </section>
  );
}
