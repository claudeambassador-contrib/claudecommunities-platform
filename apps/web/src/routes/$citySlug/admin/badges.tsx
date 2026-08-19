import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listBadges } from "@/modules/badges/services/badgesService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadBadges = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, "badges.view", async (page) => {
      const result = await listBadges(page.store);
      if (!result.ok) {
        return result;
      }
      return ok({
        badges: result.badges.map((badge) => ({
          detail: `${badge.userCount} awarded`,
          id: badge.id,
          title: badge.name,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/badges")({
  loader: ({ params }) => loadBadges({ data: { citySlug: params.citySlug } }),
  component: AdminBadgesPage,
});

function AdminBadgesPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Badges" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Badges" />
      <ItemList empty="No badges yet." items={data.badges} />
    </section>
  );
}
