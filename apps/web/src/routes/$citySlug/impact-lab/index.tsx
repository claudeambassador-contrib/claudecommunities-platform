import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import {
  getPublicConfig,
  listSponsors,
  listStatements,
  registerInterest,
} from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ItemList, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
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

const submitInterestInput = z.object({
  citySlug: z.string().min(1),
  email: z.string(),
  name: z.string(),
});

// Public interest form — intentionally no auth guard.
const submitInterest = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitInterestInput.parse(input))
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

function Page(): ReactElement {
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
          <p className="muted m-0">{config.eventDate}</p>
        </div>
      ) : null}
      <ItemList empty="Problem statements will appear here." items={statements} />
      <ItemList empty="Sponsors will be announced soon." items={sponsors} />
      <InterestForm citySlug={tenant.slug} />
    </section>
  );
}

function InterestForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    invalidate: false,
    resetOnSuccess: true,
    submit: (fd) =>
      submitInterest({
        data: {
          citySlug,
          email: formString(fd, "email"),
          name: formString(fd, "name"),
        },
      }),
    successMessage: "Thanks — we will be in touch.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Register interest</strong>
      <label className="field-label">
        Your name
        <input className="field" name="name" placeholder="Your name" />
      </label>
      <label className="field-label">
        Email
        <input className="field" name="email" placeholder="Email" required type="email" />
      </label>
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Submitting…" : "Submit"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
    </form>
  );
}
