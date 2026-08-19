import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listTemplates } from "@/modules/email/services/emailCampaignsService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadTemplatesInput = z.object({ citySlug: z.string().min(1) });

const loadTemplates = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadTemplatesInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "email.view", async (page) => {
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
