import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { getEmailSettings, saveEmailSettings } from "@/modules/email/services/emailOpsService";
import type { EmailSettingsDetail } from "@/modules/email/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadEmailSettings = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, "email.settings", async (page) => {
      const loaded = await getEmailSettings(page.store, page.actor);
      if (!loaded.ok) {
        return loaded;
      }
      return ok({ settings: loaded.settings });
    }),
  );

const submitEmailSettings = createServerFn({ method: "POST" })
  .validator(
    (d: {
      citySlug: string;
      senderEmail: string;
      senderName: string;
      trackClicks: boolean;
      trackOpens: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await saveEmailSettings(page.store, page.actor, {
      senderEmail: data.senderEmail,
      senderName: data.senderName,
      trackClicks: data.trackClicks,
      trackOpens: data.trackOpens,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/email/settings")({
  loader: ({ params }) => loadEmailSettings({ data: { citySlug: params.citySlug } }),
  component: EmailSettingsPage,
});

function EmailSettingsPage() {
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

function SettingsForm({ citySlug, settings }: { citySlug: string; settings: EmailSettingsDetail }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await submitEmailSettings({
        data: {
          citySlug,
          senderEmail: String(fd.get("senderEmail") ?? ""),
          senderName: String(fd.get("senderName") ?? ""),
          trackClicks: fd.get("trackClicks") === "on",
          trackOpens: fd.get("trackOpens") === "on",
        },
      });
      if (result.ok) {
        setStatus("Saved.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input
        className="field"
        defaultValue={settings.senderName}
        name="senderName"
        placeholder="Sender name"
      />
      <input
        className="field"
        defaultValue={settings.senderEmail}
        name="senderEmail"
        placeholder="Sender email"
        type="email"
      />
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
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Save
      </button>
    </form>
  );
}
