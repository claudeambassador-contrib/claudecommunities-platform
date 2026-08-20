import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadToolsInput = cityInput();

const loadTools = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadToolsInput.parse(input))
  .handler(
    cityHandler((page) => {
      const base = `/${page.tenant.slug}/admin/tools`;
      return Promise.resolve(
        ok({
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
        }),
      );
    }, "tools.use"),
  );

export const Route = createFileRoute("/$citySlug/admin/tools/")({
  loader: ({ params }) => loadTools({ data: { citySlug: params.citySlug } }),
  component: AdminToolsPage,
});

function AdminToolsPage(): ReactElement {
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
