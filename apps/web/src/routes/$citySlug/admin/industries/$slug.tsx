import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { getIndustry, saveIndustry } from "@/modules/pages/services/industriesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadIndustry = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, industry: null, reason: "unauthenticated" };
    }
    const found = await getIndustry(page.store, page.actor, data.slug);
    if (!found.ok) {
      return { allowed: false as const, industry: null, reason: found.error.code };
    }
    return { allowed: true as const, industry: found.industry };
  });

const submitIndustry = createServerFn({ method: "POST" })
  .validator((d: { body: string; citySlug: string; slug: string; title: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await saveIndustry(page.store, page.actor, {
      body: data.body,
      slug: data.slug,
      status: "published",
      title: data.title,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/industries/$slug")({
  loader: ({ params }) => loadIndustry({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: IndustryDetailPage,
});

function IndustryDetailPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!(data.allowed && data.industry)) {
    return <DeniedCard reason={data.reason} title="Industry" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/industries`}>
            Back
          </a>
        }
        subtitle={`/for/${data.industry.slug}`}
        title={data.industry.title}
      />
      <Can
        fallback={<EmptyCard>You can view this industry but not edit it.</EmptyCard>}
        permission="pages.edit"
      >
        <EditIndustryForm
          body={data.industry.body}
          citySlug={citySlug}
          slug={data.industry.slug}
          title={data.industry.title}
        />
      </Can>
    </section>
  );
}

function EditIndustryForm({
  body,
  citySlug,
  slug,
  title,
}: {
  body: string;
  citySlug: string;
  slug: string;
  title: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await submitIndustry({
        data: {
          body: String(fd.get("body") ?? ""),
          citySlug,
          slug,
          title: String(fd.get("title") ?? ""),
        },
      });
      setStatus(result.ok ? "Saved." : result.error);
    },
    [citySlug, slug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" defaultValue={title} name="title" required />
      <textarea
        className="field"
        defaultValue={body}
        name="body"
        rows={8}
        style={{ width: "100%" }}
      />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Save
      </button>
    </form>
  );
}
