import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { createTalkSubmission } from "@/modules/talks/services/talksService";
import { cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { PageHeader, SignInCard } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    return { signedIn: page.ok && Boolean(page.actor) };
  });

const submitTalkInput = cityInput({
  description: z.string(),
  email: z.string(),
  name: z.string(),
  title: z.string(),
});

const submitTalk = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitTalkInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      createTalkSubmission(page.store, page.actor, {
        city: page.tenant.name,
        description: data.description,
        email: data.email,
        name: data.name,
        title: data.title,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/speak/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
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
        <p className="m-0">
          Workflows, demos, production lessons, or a beginner intro — all experience levels welcome.
          We review submissions and follow up about timing.
        </p>
      </div>
      {signedIn ? <SpeakForm citySlug={tenant.slug} /> : <SignInCard href="/login" />}
    </section>
  );
}

function SpeakForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    invalidate: false,
    resetOnSuccess: true,
    submit: (fd) =>
      submitTalk({
        data: {
          citySlug,
          description: formString(fd, "description"),
          email: formString(fd, "email"),
          name: formString(fd, "name"),
          title: formString(fd, "title"),
        },
      }),
    successMessage: "Thanks — we will be in touch.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Submit a talk</strong>
      <label className="field-label">
        Your name
        <input className="field" name="name" placeholder="Your name" required />
      </label>
      <label className="field-label">
        Email
        <input className="field" name="email" placeholder="Email" required type="email" />
      </label>
      <label className="field-label">
        Talk title
        <input className="field" name="title" placeholder="Talk title" required />
      </label>
      <label className="field-label">
        Description
        <textarea
          className="field w-full"
          name="description"
          placeholder="What will you talk about?"
          rows={4}
        />
      </label>
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Submitting…" : "Submit"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
    </form>
  );
}
