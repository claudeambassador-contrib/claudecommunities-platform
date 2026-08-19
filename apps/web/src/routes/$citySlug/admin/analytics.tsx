import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listActivity } from "@/modules/activity/services/activityService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, EmptyCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadAnalytics = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "analytics.view");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    const result = await listActivity(page.store);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    const counts: Record<string, number> = {};
    for (const activity of result.activities) {
      counts[activity.type] = (counts[activity.type] ?? 0) + 1;
    }
    return {
      allowed: true as const,
      counts: Object.entries(counts).map(([type, count]) => ({
        detail: `${count}`,
        id: type,
        title: type,
      })),
      total: result.activities.length,
    };
  });

export const Route = createFileRoute("/$citySlug/admin/analytics")({
  loader: ({ params }) => loadAnalytics({ data: { citySlug: params.citySlug } }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Analytics" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle={`${data.total} activity events`} title="Analytics" />
      {data.counts.length === 0 ? (
        <EmptyCard>No activity recorded yet.</EmptyCard>
      ) : (
        <ItemList empty="No activity recorded yet." items={data.counts} />
      )}
    </section>
  );
}
