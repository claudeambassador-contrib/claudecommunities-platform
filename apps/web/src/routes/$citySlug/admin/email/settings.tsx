import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { getEmailSettings, saveEmailSettings } from "@/modules/email/services/emailOpsService";
import type { EmailSettingsDetail } from "@/modules/email/types";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadEmailSettingsInput = cityInput();

const loadEmailSettings = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadEmailSettingsInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const loaded = await getEmailSettings(page.store, page.actor);
      if (!loaded.ok) {
        return loaded;
      }
      return ok({ settings: loaded.settings });
    }),
  );

const submitEmailSettingsInput = cityInput({
  senderEmail: z.string(),
  senderName: z.string(),
  trackClicks: z.boolean(),
  trackOpens: z.boolean(),
});

const submitEmailSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitEmailSettingsInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      saveEmailSettings(page.store, page.actor, {
        senderEmail: data.senderEmail,
        senderName: data.senderName,
        trackClicks: data.trackClicks,
        trackOpens: data.trackOpens,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/email/settings")({
  loader: ({ params }) => loadEmailSettings({ data: { citySlug: params.citySlug } }),
  component: EmailSettingsPage,
});

function EmailSettingsPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Email settings" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Sender identity and tracking flags." title="Email settings" />
      <SettingsForm citySlug={citySlug} settings={data.settings} />
    </section>
  );
}

function SettingsForm({
  citySlug,
  settings,
}: {
  citySlug: string;
  settings: EmailSettingsDetail;
}): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    submit: (fd) =>
      submitEmailSettings({
        data: {
          citySlug,
          senderEmail: formString(fd, "senderEmail"),
          senderName: formString(fd, "senderName"),
          trackClicks: fd.get("trackClicks") === "on",
          trackOpens: fd.get("trackOpens") === "on",
        },
      }),
    successMessage: "Saved.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Sender name
        <input
          className="field"
          defaultValue={settings.senderName}
          name="senderName"
          placeholder="Sender name"
        />
      </label>
      <label className="field-label">
        Sender email
        <input
          className="field"
          defaultValue={settings.senderEmail}
          name="senderEmail"
          placeholder="Sender email"
          type="email"
        />
      </label>
      <label htmlFor="trackOpens">
        <input
          defaultChecked={settings.trackOpens}
          id="trackOpens"
          name="trackOpens"
          type="checkbox"
        />{" "}
        Track opens
      </label>
      <label htmlFor="trackClicks">
        <input
          defaultChecked={settings.trackClicks}
          id="trackClicks"
          name="trackClicks"
          type="checkbox"
        />{" "}
        Track clicks
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
