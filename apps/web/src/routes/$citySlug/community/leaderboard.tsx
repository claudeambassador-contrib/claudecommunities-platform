import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listActivity } from "@/modules/activity/services/activityService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ItemList, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { rows: [] as { count: number; userId: string }[] };
    }
    const activity = await listActivity(page.store, { limit: 100 });
    const counts = new Map<string, number>();
    for (const item of activity.ok ? activity.activities : []) {
      counts.set(item.userId, (counts.get(item.userId) ?? 0) + 1);
    }
    return {
      rows: [...counts.entries()]
        .map(([userId, count]) => ({ count, userId }))
        .sort((a, b) => b.count - a.count),
    };
  });

export const Route = createFileRoute("/$citySlug/community/leaderboard")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { rows } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader subtitle="Activity counts by member" title="Leaderboard" />
      <ItemList
        empty="No activity yet."
        items={rows.map((row, index) => ({
          detail: `${row.count} ${row.count === 1 ? "action" : "actions"}`,
          id: row.userId,
          title: `#${index + 1} · ${row.userId}`,
        }))}
      />
    </section>
  );
}
