import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { createCampaign } from "@/modules/email/services/emailCampaignsService";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import type { Mutated } from "@/shared/http/guarded";
import { Can } from "@/shared/ui/can";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = cityInput();

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(cityHandler(async () => ok({}), "email.view"));

const submitInput = cityInput({
  bodyHtml: z.string(),
  name: z.string(),
  scheduledAt: z.string(),
  subject: z.string(),
});

const submit = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitInput.parse(input))
  .handler(
    cityMutationHandler(async (page, data) => {
      const result = await createCampaign(page.store, page.actor, {
        bodyHtml: data.bodyHtml,
        name: data.name,
        scheduledAt: data.scheduledAt.trim() || null,
        subject: data.subject,
      });
      if (!result.ok) {
        return result;
      }
      return ok({ id: result.campaign.id });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/email/new")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();
  const navigate = useNavigate();

  const { error, handleSubmit, pending, success } = useFormSubmit<Mutated<{ id: string }>>({
    onSuccess: async (result) => {
      await navigate({
        params: { citySlug, id: result.id },
        to: "/$citySlug/admin/email/$id",
      });
    },
    submit: (fd) =>
      submit({
        data: {
          bodyHtml: formString(fd, "bodyHtml"),
          citySlug,
          name: formString(fd, "name"),
          scheduledAt: formString(fd, "scheduledAt"),
          subject: formString(fd, "subject"),
        },
      }),
  });

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="New campaign" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/email`}>
            All campaigns
          </a>
        }
        title="New campaign"
      />
      <Can permission="email.edit">
        <form className="card stack" onSubmit={handleSubmit}>
          <label className="field-label">
            Campaign name
            <input className="field" name="name" placeholder="Campaign name" required />
          </label>
          <label className="field-label">
            Subject
            <input className="field" name="subject" placeholder="Subject" required />
          </label>
          <label className="field-label">
            Scheduled at
            <input className="field" name="scheduledAt" type="datetime-local" />
          </label>
          <label className="field-label">
            Body HTML
            <textarea
              className="field w-full"
              name="bodyHtml"
              placeholder="<h1>Hello</h1><p>Write the email body in HTML.</p>"
              rows={14}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}
          <button className="btn btn-primary" disabled={pending} type="submit">
            {pending ? "Creating…" : "Create draft"}
          </button>
        </form>
      </Can>
    </section>
  );
}
