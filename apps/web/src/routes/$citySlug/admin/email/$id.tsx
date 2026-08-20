import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { z } from "zod";
import {
  campaignWorkflowFromEnv,
  enqueueCampaignSend,
  getCampaign,
  updateCampaign,
} from "@/modules/email/services/emailCampaignsService";
import type { CampaignDetail } from "@/modules/email/types";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = cityInput({ id: z.string() });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(
    cityHandler(async (page, data) => {
      const found = await getCampaign(page.store, page.actor, data.id);
      if (!found.ok) {
        return found;
      }
      return ok({ campaign: found.campaign });
    }),
  );

const saveInput = cityInput({
  bodyHtml: z.string(),
  id: z.string(),
  name: z.string(),
  scheduledAt: z.string(),
  subject: z.string(),
});

const save = createServerFn({ method: "POST" })
  .validator((input: unknown) => saveInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      updateCampaign(page.store, page.actor, data.id, {
        bodyHtml: data.bodyHtml,
        name: data.name,
        scheduledAt: data.scheduledAt.trim() || null,
        subject: data.subject,
      }),
    ),
  );

const sendNowInput = cityInput({ id: z.string() });

const sendNow = createServerFn({ method: "POST" })
  .validator((input: unknown) => sendNowInput.parse(input))
  .handler(
    cityMutationHandler(async (page, data) => {
      const { workerEnv } = await import("@/shared/db/env");
      return enqueueCampaignSend(
        page.store,
        page.actor,
        data.id,
        campaignWorkflowFromEnv(workerEnv()),
      );
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/email/$id")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, id: params.id } }),
  component: Page,
});

function toLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Page(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Campaign" />;
  }

  return <CampaignBuilder campaign={data.campaign} citySlug={citySlug} />;
}

function CampaignBuilder({
  campaign,
  citySlug,
}: {
  campaign: CampaignDetail;
  citySlug: string;
}): ReactElement {
  const router = useRouter();
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(campaign.bodyHtml ?? "");
  const locked = campaign.status !== "draft" && campaign.status !== "scheduled";

  const handleBody = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
    setPreview(event.currentTarget.value);
  }, []);

  const { error, handleSubmit, pending, success } = useFormSubmit({
    submit: (fd) =>
      save({
        data: {
          bodyHtml: formString(fd, "bodyHtml"),
          citySlug,
          id: campaign.id,
          name: formString(fd, "name"),
          scheduledAt: formString(fd, "scheduledAt"),
          subject: formString(fd, "subject"),
        },
      }),
    successMessage: "Saved.",
  });

  const handleSend = useCallback(async () => {
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    const result = await sendNow({ data: { citySlug, id: campaign.id } });
    setSending(false);
    if (result.ok) {
      setSendSuccess("Send queued.");
      await router.invalidate();
      return;
    }
    setSendError(result.error);
  }, [campaign.id, citySlug, router]);

  const previewDoc = useMemo(
    () => preview || "<p class='muted'>Preview appears here.</p>",
    [preview],
  );

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/email`}>
            All campaigns
          </a>
        }
        subtitle={campaign.status}
        title={campaign.name}
      />
      {locked ? (
        <EmptyCard>This campaign can no longer be edited.</EmptyCard>
      ) : (
        <Can permission="email.edit">
          <form className="card stack" onSubmit={handleSubmit}>
            <label className="field-label">
              Name
              <input className="field" defaultValue={campaign.name} name="name" required />
            </label>
            <label className="field-label">
              Subject
              <input className="field" defaultValue={campaign.subject} name="subject" required />
            </label>
            <label className="field-label">
              Scheduled at
              <input
                className="field"
                defaultValue={toLocalInput(campaign.scheduledAt)}
                name="scheduledAt"
                type="datetime-local"
              />
            </label>
            <label className="field-label">
              Body HTML
              <textarea
                className="field w-full"
                defaultValue={campaign.bodyHtml ?? ""}
                name="bodyHtml"
                onInput={handleBody}
                rows={14}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}
            {sendError ? <p className="form-error">{sendError}</p> : null}
            {sendSuccess ? <p className="form-success">{sendSuccess}</p> : null}
            <div className="row">
              <button className="btn btn-primary" disabled={pending} type="submit">
                {pending ? "Saving…" : "Save"}
              </button>
              <Can permission="email.send">
                <button className="btn" disabled={sending} onClick={handleSend} type="button">
                  {sending ? "Sending…" : "Send"}
                </button>
              </Can>
            </div>
          </form>
        </Can>
      )}
      <div className="card stack">
        <strong>Preview</strong>
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-authored campaign preview
          dangerouslySetInnerHTML={{ __html: previewDoc }}
        />
      </div>
    </section>
  );
}
