import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getEmailAnalytics } from "@/modules/email/services/emailOpsService";
import type { EmailAnalytics } from "@/modules/email/types";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const EMPTY_ANALYTICS: EmailAnalytics = { byCampaign: [], queued: 0, totalSends: 0 };

const loadEmailAnalytics = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return {
        allowed: false as const,
        analytics: EMPTY_ANALYTICS,
        reason: "unauthenticated",
      };
    }
    const perm = ensurePermission(page.actor, "email.view");
    if (!perm.ok) {
      return {
        allowed: false as const,
        analytics: EMPTY_ANALYTICS,
        reason: perm.error.code,
      };
    }
    const loaded = await getEmailAnalytics(page.store, page.actor);
    if (!loaded.ok) {
      return {
        allowed: false as const,
        analytics: EMPTY_ANALYTICS,
        reason: loaded.error.code,
      };
    }
    return {
      allowed: true as const,
      analytics: {
        byCampaign: loaded.byCampaign,
        queued: loaded.queued,
        totalSends: loaded.totalSends,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/admin/email/analytics")({
  loader: ({ params }) => loadEmailAnalytics({ data: { citySlug: params.citySlug } }),
  component: EmailAnalyticsPage,
});

function EmailAnalyticsPage() {
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
