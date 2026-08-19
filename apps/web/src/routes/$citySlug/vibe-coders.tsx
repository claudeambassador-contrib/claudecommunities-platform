import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    await loadCityPage(data.citySlug);
    return {};
  });

export const Route = createFileRoute("/$citySlug/vibe-coders")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { countryName } = getRegionConfig();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <Link
              className="btn btn-primary"
              params={{ citySlug: tenant.slug }}
              to="/$citySlug/events"
            >
              Browse events
            </Link>
            <a className="btn" href={`/${tenant.slug}/for`}>
              Industry guides
            </a>
          </div>
        }
        subtitle={`Beginner-friendly Claude Code meetups across ${countryName}.`}
        title="Vibe coders"
      />
      <div className="card">
        <p style={{ margin: 0 }}>
          No computer-science degree required. Describe what you want to build and work with Claude
          Code — websites, automations, prototypes, and side projects. Come as you are.
        </p>
      </div>
    </section>
  );
}
