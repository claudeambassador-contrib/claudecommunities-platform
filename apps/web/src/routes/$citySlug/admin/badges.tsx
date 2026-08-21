import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";

import { listBadges } from "@/modules/badges/services/badgesService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadBadgesInput = cityInput();

const loadBadges = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadBadgesInput.parse(input))
  .handler(
    cityHandler(async (page) => {
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
    }, "badges.view"),
  );

export const Route = createFileRoute("/$citySlug/admin/badges")({
  loader: ({ params }) => loadBadges({ data: { citySlug: params.citySlug } }),
  component: AdminBadgesPage,
});

function AdminBadgesPage(): ReactElement {
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
