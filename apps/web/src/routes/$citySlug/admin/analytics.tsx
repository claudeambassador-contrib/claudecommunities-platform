import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { listActivity } from "@/modules/activity/services/activityService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, EmptyCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadAnalyticsInput = cityInput();

const loadAnalytics = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadAnalyticsInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const result = await listActivity(page.store);
      if (!result.ok) {
        return result;
      }
      const counts: Record<string, number> = {};
      for (const activity of result.activities) {
        counts[activity.type] = (counts[activity.type] ?? 0) + 1;
      }
      return ok({
        counts: Object.entries(counts).map(([type, count]) => ({
          detail: `${count}`,
          id: type,
          title: type,
        })),
        total: result.activities.length,
      });
    }, "analytics.view"),
  );

export const Route = createFileRoute("/$citySlug/admin/analytics")({
  loader: ({ params }) => loadAnalytics({ data: { citySlug: params.citySlug } }),
  component: AnalyticsPage,
});

function AnalyticsPage(): ReactElement {
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
