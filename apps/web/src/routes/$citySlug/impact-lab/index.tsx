import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import {
  getPublicConfig,
  listSponsors,
  listStatements,
  registerInterest,
} from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ItemList, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        config: null as {
          eventDate: string;
          eventName: string;
          eventTagline: string;
        } | null,
        sponsors: [] as { detail?: string; href?: string; id: string; title: string }[],
        statements: [] as { detail?: string; id: string; title: string }[],
      };
    }
    const [config, statements, sponsors] = await Promise.all([
      getPublicConfig(page.registry),
      listStatements(page.registry),
      listSponsors(page.registry),
    ]);
    return {
      config: config.ok
        ? {
            eventDate: config.config.eventDate,
            eventName: config.config.eventName,
            eventTagline: config.config.eventTagline,
          }
        : null,
      sponsors: sponsors.ok
        ? sponsors.sponsors.map((sponsor) => ({
            detail: sponsor.website ?? undefined,
            href: sponsor.website ?? undefined,
            id: sponsor.id,
            title: sponsor.name,
          }))
        : [],
      statements: statements.ok
        ? statements.statements.map((statement) => ({
            detail: statement.summary,
            id: statement.id,
            title: statement.title,
          }))
        : [],
    };
  });

const submitInterest = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; email: string; name: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { ok: false as const, error: page.error.message ?? "City not found" };
    }
    const result = await registerInterest(page.registry, {
      email: data.email,
      name: data.name,
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error.message ?? result.error.code };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/impact-lab/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { config, sponsors, statements } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn btn-primary" href={`/${tenant.slug}/impact-lab/portal`}>
              Check in
            </a>
            <a className="btn" href={`/${tenant.slug}/events/claude-impact-lab-melbourne`}>
              Melbourne event
            </a>
          </div>
        }
        subtitle={config?.eventTagline ?? "Build AI tools on real civic data."}
        title={config?.eventName ?? "Claude Impact Lab"}
      />
      {config?.eventDate ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {config.eventDate}
          </p>
        </div>
      ) : null}
      <ItemList empty="Problem statements will appear here." items={statements} />
      <ItemList empty="Sponsors will be announced soon." items={sponsors} />
      <InterestForm citySlug={tenant.slug} />
    </section>
  );
}

function InterestForm({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const result = await submitInterest({
        data: {
          citySlug,
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? ""),
        },
      });
      if (result.ok) {
        form.reset();
        setStatus("Thanks — we will be in touch.");
      } else {
        setStatus(result.error);
      }
    },
    [citySlug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Register interest</strong>
      <input className="btn" name="name" placeholder="Your name" style={{ width: "100%" }} />
      <input
        className="btn"
        name="email"
        placeholder="Email"
        required
        style={{ width: "100%" }}
        type="email"
      />
      <button className="btn btn-primary" type="submit">
        Submit
      </button>
      {status ? (
        <p className="muted" style={{ margin: 0 }}>
          {status}
        </p>
      ) : null}
    </form>
  );
}
