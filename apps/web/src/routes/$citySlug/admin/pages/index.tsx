import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listContentPages } from "@/modules/pages/services/pagesService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadPagesInput = z.object({ citySlug: z.string().min(1) });

const loadPages = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadPagesInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "pages.view", async (page) => {
      const result = await listContentPages(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        pages: result.pages.map((item) => ({
          detail: `${item.status} · /${item.slug}`,
          href: `/${page.tenant.slug}/admin/pages/${item.id}`,
          id: item.id,
          title: item.title,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/pages/")({
  loader: ({ params }) => loadPages({ data: { citySlug: params.citySlug } }),
  component: AdminPagesPage,
});

function AdminPagesPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Pages" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn" href={`/${citySlug}/admin/pages/home`}>
              Home CMS
            </a>
            <a className="btn" href={`/${citySlug}/admin/pages/new`}>
              New page
            </a>
          </div>
        }
        title="Pages"
      />
      <ItemList empty="No content pages yet." items={data.pages} />
    </section>
  );
}
