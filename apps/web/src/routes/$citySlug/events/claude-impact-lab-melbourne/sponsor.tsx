import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { registerInterest } from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    await loadCityPage(data.citySlug);
    return {};
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

export const Route = createFileRoute("/$citySlug/events/claude-impact-lab-melbourne/sponsor")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
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
        <p style={{ margin: 0 }}>
          Help put on Australia&apos;s first Claude Impact Lab. Tell us how you&apos;d like to be
          involved and we&apos;ll follow up within a few days.
        </p>
      </div>
      <SponsorForm citySlug={tenant.slug} />
    </section>
  );
}

function SponsorForm({ citySlug }: { citySlug: string }) {
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
      <strong>Sponsorship interest</strong>
      <input
        className="btn"
        name="name"
        placeholder="Name or organisation"
        required
        style={{ width: "100%" }}
      />
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
