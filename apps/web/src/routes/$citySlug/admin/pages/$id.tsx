import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getContentPage } from "@/modules/pages/services/pagesService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadPage = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; id: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, null, async (page) => {
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

function ContentPageDetail() {
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
        <p className="muted" style={{ margin: 0 }}>
          {data.page.blockCount} sections
        </p>
      </div>
    </section>
  );
}
