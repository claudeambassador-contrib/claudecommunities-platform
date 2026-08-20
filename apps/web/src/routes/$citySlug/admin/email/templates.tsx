import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { listTemplates } from "@/modules/email/services/emailCampaignsService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadTemplatesInput = cityInput();

const loadTemplates = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadTemplatesInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const result = await listTemplates(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        templates: result.templates.map((template) => ({
          detail: template.subject ?? "No subject",
          id: template.id,
          title: template.name,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/email/templates")({
  loader: ({ params }) => loadTemplates({ data: { citySlug: params.citySlug } }),
  component: EmailTemplatesPage,
});

function EmailTemplatesPage(): ReactElement {
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
