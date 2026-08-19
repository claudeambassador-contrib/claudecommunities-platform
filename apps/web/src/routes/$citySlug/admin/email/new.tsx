import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { createCampaign } from "@/modules/email/services/emailCampaignsService";
import { loadCityPage } from "@/shared/http/cityPage";
import { Can } from "@/shared/ui/can";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    return { allowed: true as const };
  });

const submit = createServerFn({ method: "POST" })
  .validator(
    (d: { bodyHtml: string; citySlug: string; name: string; scheduledAt: string; subject: string }) =>
      d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await createCampaign(page.store, page.actor, {
      bodyHtml: data.bodyHtml,
      name: data.name,
      scheduledAt: data.scheduledAt.trim() || null,
      subject: data.subject,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { id: result.campaign.id, ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/email/new")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await submit({
        data: {
          bodyHtml: String(fd.get("bodyHtml") ?? ""),
          citySlug,
          name: String(fd.get("name") ?? ""),
          scheduledAt: String(fd.get("scheduledAt") ?? ""),
          subject: String(fd.get("subject") ?? ""),
        },
      });
      if (result.ok) {
        await router.navigate({
          params: { citySlug, id: result.id },
          to: "/$citySlug/admin/email/$id",
        });
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

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
          <input className="field" name="name" placeholder="Campaign name" required />
          <input className="field" name="subject" placeholder="Subject" required />
          <input className="field" name="scheduledAt" type="datetime-local" />
          <textarea
            className="field"
            name="bodyHtml"
            placeholder="<h1>Hello</h1><p>Write the email body in HTML.</p>"
            rows={14}
            style={{ width: "100%" }}
          />
          {status ? <p className="muted">{status}</p> : null}
          <button className="btn btn-primary" type="submit">
            Create draft
          </button>
        </form>
      </Can>
    </section>
  );
}
