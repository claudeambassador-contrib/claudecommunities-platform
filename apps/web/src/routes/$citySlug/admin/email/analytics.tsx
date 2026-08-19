import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getEmailAnalytics } from "@/modules/email/services/emailOpsService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadEmailAnalyticsInput = z.object({ citySlug: z.string().min(1) });

const loadEmailAnalytics = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadEmailAnalyticsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "email.view", async (page) => {
      const loaded = await getEmailAnalytics(page.store, page.actor);
      if (!loaded.ok) {
        return loaded;
      }
      return ok({
        analytics: {
          byCampaign: loaded.byCampaign,
          queued: loaded.queued,
          totalSends: loaded.totalSends,
        },
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/email/analytics")({
  loader: ({ params }) => loadEmailAnalytics({ data: { citySlug: params.citySlug } }),
  component: EmailAnalyticsPage,
});

function EmailAnalyticsPage(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Email analytics" />;
  }

  const { analytics } = data;
  if (analytics.totalSends === 0) {
    return (
      <section className="stack">
        <PageHeader subtitle="Send counts from email_sends." title="Email analytics" />
        <EmptyCard>No email sends yet.</EmptyCard>
      </section>
    );
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Send counts from email_sends." title="Email analytics" />
      <article className="card">
        <strong>Total sends</strong>
        <div className="muted">{analytics.totalSends}</div>
      </article>
      <article className="card">
        <strong>Queued</strong>
        <div className="muted">{analytics.queued}</div>
      </article>
      {analytics.byCampaign.length === 0 ? (
        <EmptyCard>No per-campaign sends yet.</EmptyCard>
      ) : (
        <div className="stack">
          {analytics.byCampaign.map((row) => (
            <article className="card" key={row.campaignId ?? "none"}>
              <strong>{row.campaignId ?? "Unassigned"}</strong>
              <div className="muted">{row.sent} rows</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
