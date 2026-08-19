import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadTools = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "tools.use");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    const base = `/${page.tenant.slug}/admin/tools`;
    return {
      allowed: true as const,
      tools: [
        {
          detail: "Style presets and slide export",
          href: `${base}/slide-generator`,
          id: "slide-generator",
          title: "Slide generator",
        },
        {
          detail: "Rank attendance candidates",
          href: `${base}/attendance-planner`,
          id: "attendance-planner",
          title: "Attendance planner",
        },
        {
          detail: "Generate QR codes",
          href: `${base}/qr-generator`,
          id: "qr-generator",
          title: "QR generator",
        },
        {
          detail: "Luma attendee insights",
          href: `${base}/attendee-analytics`,
          id: "attendee-analytics",
          title: "Attendee analytics",
        },
      ],
    };
  });

export const Route = createFileRoute("/$citySlug/admin/tools/")({
  loader: ({ params }) => loadTools({ data: { citySlug: params.citySlug } }),
  component: AdminToolsPage,
});

function AdminToolsPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Tools" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Tools" />
      <ItemList empty="No tools available." items={data.tools} />
    </section>
  );
}
