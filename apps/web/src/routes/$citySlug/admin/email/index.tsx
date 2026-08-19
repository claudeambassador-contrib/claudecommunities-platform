import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listCampaigns } from "@/modules/email/services/emailCampaignsService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadCampaignsInput = z.object({ citySlug: z.string().min(1) });

const loadCampaigns = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadCampaignsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "email.view", async (page) => {
      const result = await listCampaigns(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        campaigns: result.campaigns.map((campaign) => ({
          detail: [campaign.status, campaign.subject].filter(Boolean).join(" · "),
          href: `/${data.citySlug}/admin/email/${campaign.id}`,
          id: campaign.id,
          title: campaign.name,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/email/")({
  loader: ({ params }) => loadCampaigns({ data: { citySlug: params.citySlug } }),
  component: AdminEmailPage,
});

function AdminEmailPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Email" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn btn-primary" href={`/${citySlug}/admin/email/new`}>
              New campaign
            </a>
            <a href={`/${citySlug}/admin/email/templates`}>Templates</a>
            <a href={`/${citySlug}/admin/email/contacts`}>Contacts</a>
            <a href={`/${citySlug}/admin/email/automations`}>Automations</a>
            <a href={`/${citySlug}/admin/email/analytics`}>Analytics</a>
            <a href={`/${citySlug}/admin/email/settings`}>Settings</a>
          </div>
        }
        title="Email"
      />
      <ItemList empty="No campaigns yet." items={data.campaigns} />
    </section>
  );
}
