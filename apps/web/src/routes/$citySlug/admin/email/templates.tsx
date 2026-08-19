import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listTemplates } from "@/modules/email/services/emailCampaignsService";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadTemplates = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listTemplates(page.store, page.actor);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      templates: result.templates.map((template) => ({
        detail: template.subject ?? "No subject",
        id: template.id,
        title: template.name,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/email/templates")({
  loader: ({ params }) => loadTemplates({ data: { citySlug: params.citySlug } }),
  component: EmailTemplatesPage,
});

function EmailTemplatesPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Templates" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Templates" />
      <ItemList empty="No templates yet." items={data.templates} />
    </section>
  );
}
