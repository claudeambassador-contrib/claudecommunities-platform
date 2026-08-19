import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listBadges } from "@/modules/badges/services/badgesService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadBadges = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "badges.view");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    const result = await listBadges(page.store);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      badges: result.badges.map((badge) => ({
        detail: `${badge.userCount} awarded`,
        id: badge.id,
        title: badge.name,
      })),
    };
  });

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
