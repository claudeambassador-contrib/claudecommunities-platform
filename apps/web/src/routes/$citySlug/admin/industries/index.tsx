import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { listIndustries } from "@/modules/pages/services/industriesService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadIndustriesInput = cityInput();

const loadIndustries = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadIndustriesInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const listed = await listIndustries(page.store, page.actor);
      if (!listed.ok) {
        return listed;
      }
      return ok({ industries: listed.industries });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/industries/")({
  loader: ({ params }) => loadIndustries({ data: { citySlug: params.citySlug } }),
  component: AdminIndustriesPage,
});

function AdminIndustriesPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Industries" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <Can permission="pages.edit">
            <a className="btn btn-primary" href={`/${citySlug}/admin/industries/new`}>
              New industry
            </a>
          </Can>
        }
        subtitle="Landing pages at /for/<path>. Built-ins can be overridden."
        title="Industries"
      />
      {data.industries.length === 0 ? (
        <EmptyCard>No industries yet.</EmptyCard>
      ) : (
        <div className="stack">
          {data.industries.map((industry) => (
            <a
              className="card block"
              href={`/${citySlug}/admin/industries/${industry.slug}`}
              key={industry.slug}
            >
              <strong>{industry.title}</strong>
              <div className="muted">
                /for/{industry.slug} · {industry.status}
                {industry.builtIn ? " · built-in" : ""}
                {industry.custom ? " · customized" : ""}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
