import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { registerInterest } from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    await loadCityPage(data.citySlug);
    return {};
  });

const submitInterestInput = z.object({
  citySlug: z.string().min(1),
  email: z.string(),
  name: z.string(),
});

// Public sponsor-interest form — intentionally no auth guard.
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

export const Route = createFileRoute("/$citySlug/events/claude-impact-lab-melbourne/sponsor")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${tenant.slug}/events/claude-impact-lab-melbourne`}>
            Back to event
          </a>
        }
        subtitle="Event, drinks, catering, venue, swag, data, and prizes."
        title="Sponsor Claude Impact Lab Melbourne"
      />
      <div className="card">
        <p className="m-0">
          Help put on Australia&apos;s first Claude Impact Lab. Tell us how you&apos;d like to be
          involved and we&apos;ll follow up within a few days.
        </p>
      </div>
      <SponsorForm citySlug={tenant.slug} />
    </section>
  );
}

function SponsorForm({ citySlug }: { citySlug: string }): ReactElement {
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
      <strong>Sponsorship interest</strong>
      <label className="field-label">
        Name or organisation
        <input className="field" name="name" placeholder="Name or organisation" required />
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
