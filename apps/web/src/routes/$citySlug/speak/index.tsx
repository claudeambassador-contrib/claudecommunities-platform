import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { createTalkSubmission } from "@/modules/talks/services/talksService";
import { loadCityPage, requireCityActor } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    return { signedIn: page.ok && Boolean(page.actor) };
  });

const submitTalk = createServerFn({ method: "POST" })
  .validator(
    (d: { citySlug: string; description: string; email: string; name: string; title: string }) => d,
  )
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { ok: false as const, error: page.error.message ?? "Sign in required" };
    }
    const result = await createTalkSubmission(page.store, page.actor, {
      city: page.tenant.name,
      description: data.description,
      email: data.email,
      name: data.name,
      title: data.title,
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error.message ?? result.error.code };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/speak/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { signedIn } = Route.useLoaderData();
  const { countryName } = getRegionConfig();

  return (
    <section className="stack">
      <PageHeader
        subtitle={`Lightning talks and full sessions at meetups across ${countryName}.`}
        title="Speak at a meetup"
      />
      <div className="card">
        <p style={{ margin: 0 }}>
          Workflows, demos, production lessons, or a beginner intro — all experience levels welcome.
          We review submissions and follow up about timing.
        </p>
      </div>
      {signedIn ? <SpeakForm citySlug={tenant.slug} /> : <SignInCard href="/login" />}
    </section>
  );
}

function SpeakForm({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const result = await submitTalk({
        data: {
          citySlug,
          description: String(fd.get("description") ?? ""),
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? ""),
          title: String(fd.get("title") ?? ""),
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
      <strong>Submit a talk</strong>
      <input
        className="btn"
        name="name"
        placeholder="Your name"
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
      <input
        className="btn"
        name="title"
        placeholder="Talk title"
        required
        style={{ width: "100%" }}
      />
      <textarea
        className="btn"
        name="description"
        placeholder="What will you talk about?"
        rows={4}
        style={{ width: "100%" }}
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
