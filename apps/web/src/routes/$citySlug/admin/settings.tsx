import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadSettings = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "tenant.settings");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    return {
      allowed: true as const,
      tenant: {
        name: page.tenant.name,
        region: page.tenant.region,
        slug: page.tenant.slug,
        timezone: page.tenant.timezone,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/admin/settings")({
  loader: ({ params }) => loadSettings({ data: { citySlug: params.citySlug } }),
  component: SettingsPage,
});

function SettingsPage() {
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
