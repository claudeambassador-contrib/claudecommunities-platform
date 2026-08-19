import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { getCampaign, updateCampaign } from "@/modules/email/services/emailCampaignsService";
import type { CampaignDetail } from "@/modules/email/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; id: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const found = await getCampaign(page.store, page.actor, data.id);
    if (!found.ok) {
      return { allowed: false as const, reason: found.error.code };
    }
    return { allowed: true as const, campaign: found.campaign };
  });

const save = createServerFn({ method: "POST" })
  .validator(
    (d: {
      bodyHtml: string;
      citySlug: string;
      id: string;
      name: string;
      scheduledAt: string;
      subject: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await updateCampaign(page.store, page.actor, data.id, {
      bodyHtml: data.bodyHtml,
      name: data.name,
      scheduledAt: data.scheduledAt.trim() || null,
      subject: data.subject,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

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

function Page() {
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
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState(campaign.bodyHtml ?? "");
  const locked = campaign.status !== "draft" && campaign.status !== "scheduled";

  const handleBody = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
    setPreview(event.currentTarget.value);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await save({
        data: {
          bodyHtml: String(fd.get("bodyHtml") ?? ""),
          citySlug,
          id: campaign.id,
          name: String(fd.get("name") ?? ""),
          scheduledAt: String(fd.get("scheduledAt") ?? ""),
          subject: String(fd.get("subject") ?? ""),
        },
      });
      if (result.ok) {
        setStatus("Saved.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [campaign.id, citySlug, router],
  );

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
            <input className="field" defaultValue={campaign.name} name="name" required />
            <input className="field" defaultValue={campaign.subject} name="subject" required />
            <input
              className="field"
              defaultValue={toLocalInput(campaign.scheduledAt)}
              name="scheduledAt"
              type="datetime-local"
            />
            <textarea
              className="field"
              defaultValue={campaign.bodyHtml ?? ""}
              name="bodyHtml"
              onInput={handleBody}
              rows={14}
              style={{ width: "100%" }}
            />
            {status ? <p className="muted">{status}</p> : null}
            <button className="btn btn-primary" type="submit">
              Save
            </button>
          </form>
        </Can>
      )}
      <div className="card stack">
        <strong>Preview</strong>
        <div
          // Preview is admin-authored HTML for this city's campaigns.
          dangerouslySetInnerHTML={{ __html: previewDoc }}
        />
      </div>
    </section>
  );
}
