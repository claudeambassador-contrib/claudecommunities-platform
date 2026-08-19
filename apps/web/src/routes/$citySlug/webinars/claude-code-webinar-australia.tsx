import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { ItemList, PageHeader } from "@/shared/ui/page";

const TALKS = [
  { id: "1", title: "Vanessa Ennis", detail: "Claude Code for a non-technical person" },
  {
    id: "2",
    title: "Mark Monfort",
    detail: "I build with Claude. And break capability barriers — every single day.",
  },
  { id: "3", title: "Stephen Colman", detail: "Claude for Non-Techie Builders" },
  { id: "4", title: "Nick Lothian", detail: "Ghost libraries" },
  {
    id: "5",
    title: "Aidan Morgan",
    detail: "Building complex systems with agentic engineering teams",
  },
  { id: "6", title: "Bojan Zivic", detail: "From Product Manager to Engineer" },
  {
    id: "7",
    title: "Adam Holt",
    detail: "From cyclone warning to live aggregator in a few hours",
  },
];

const REPLAY_HREF = "https://www.youtube.com/watch?v=3-G3raRMl4w";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    await loadCityPage(data.citySlug);
    return {};
  });

export const Route = createFileRoute("/$citySlug/webinars/claude-code-webinar-australia")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { siteName } = getRegionConfig();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn btn-primary" href={REPLAY_HREF} rel="noreferrer" target="_blank">
              Watch replay
            </a>
            <Link className="btn" params={{ citySlug: tenant.slug }} to="/$citySlug/events">
              Upcoming events
            </Link>
          </div>
        }
        subtitle={`${siteName} — seven lightning talks on shipping with Claude Code.`}
        title="Claude Code webinar Australia"
      />
      <div className="card">
        <p className="m-0">
          Replay of the Australia webinar: how local developers and founders use Claude Code in real
          workflows. Hosted with community lightning talks.
        </p>
      </div>
      <ItemList empty="Talks coming soon." items={TALKS} />
    </section>
  );
}
