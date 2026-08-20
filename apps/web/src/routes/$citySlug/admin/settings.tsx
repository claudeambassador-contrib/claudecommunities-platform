import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadSettingsInput = cityInput();

const loadSettings = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadSettingsInput.parse(input))
  .handler(
    cityHandler(
      (page) =>
        Promise.resolve(
          ok({
            tenant: {
              name: page.tenant.name,
              region: page.tenant.region,
              slug: page.tenant.slug,
              timezone: page.tenant.timezone,
            },
          }),
        ),
      "tenant.settings",
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/settings")({
  loader: ({ params }) => loadSettings({ data: { citySlug: params.citySlug } }),
  component: SettingsPage,
});

function SettingsPage(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Settings" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Settings" />
      <div className="card stack">
        <div>
          <strong>Name</strong>
          <div className="muted">{data.tenant.name}</div>
        </div>
        <div>
          <strong>Slug</strong>
          <div className="muted">{data.tenant.slug}</div>
        </div>
        <div>
          <strong>Region</strong>
          <div className="muted">{data.tenant.region}</div>
        </div>
        <div>
          <strong>Timezone</strong>
          <div className="muted">{data.tenant.timezone}</div>
        </div>
      </div>
    </section>
  );
}
