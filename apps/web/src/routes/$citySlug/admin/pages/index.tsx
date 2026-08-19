import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listContentPages } from "@/modules/pages/services/pagesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadPages = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listContentPages(page.store, page.actor);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      pages: result.pages.map((item) => ({
        detail: `${item.status} · /${item.slug}`,
        href: `/${page.tenant.slug}/admin/pages/${item.id}`,
        id: item.id,
        title: item.title,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/pages/")({
  loader: ({ params }) => loadPages({ data: { citySlug: params.citySlug } }),
  component: AdminPagesPage,
});

function AdminPagesPage() {
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
