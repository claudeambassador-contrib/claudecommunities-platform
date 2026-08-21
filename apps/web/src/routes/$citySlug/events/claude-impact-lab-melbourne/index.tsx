import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { getPublicConfig } from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { PageHeader } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        config: null as { eventDate: string; eventName: string; eventTagline: string } | null,
      };
    }
    const config = await getPublicConfig(page.registry);
    return {
      config: config.ok
        ? {
            eventDate: config.config.eventDate,
            eventName: config.config.eventName,
            eventTagline: config.config.eventTagline,
          }
        : null,
    };
  });

export const Route = createFileRoute("/$citySlug/events/claude-impact-lab-melbourne/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { config } = Route.useLoaderData();
  const city = { citySlug: tenant.slug };

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn btn-primary" href={`/${tenant.slug}/impact-lab`}>
              Participant portal
            </a>
            <a className="btn" href={`/${tenant.slug}/events/claude-impact-lab-melbourne/sponsor`}>
              Sponsor
            </a>
            <Link className="btn" params={city} to="/$citySlug/events">
              All events
            </Link>
          </div>
        }
        subtitle={config?.eventTagline ?? "One day. Real city data. AI tools that matter."}
        title={config?.eventName ?? "Claude Impact Lab Melbourne"}
      />
      <div className="card stack">
        <p className="muted m-0">
          {config?.eventDate || "Saturday, May 23, 2026"} · Melbourne, VIC
        </p>
        <p className="m-0">
          Australia&apos;s first Claude Impact Lab. Teams partner with local government and
          nonprofits to build AI tools on real Melbourne civic data — transport, planning, council
          records, and public services.
        </p>
      </div>
      <div className="card stack">
        <strong>What participants get</strong>
        <p className="muted m-0">
          API credits, expert judges, a room of builders, and merch. Free to attend.
        </p>
      </div>
      <div className="card stack">
        <strong>Get involved</strong>
        <div className="row">
          <a href={`/${tenant.slug}/impact-lab`}>Register interest</a>
          <a href={`/${tenant.slug}/events/claude-impact-lab-melbourne/sponsor`}>
            Sponsor or partner
          </a>
        </div>
      </div>
    </section>
  );
}
