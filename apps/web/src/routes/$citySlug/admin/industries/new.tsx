import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { saveIndustry } from "@/modules/pages/services/industriesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadNewIndustry = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) => guarded(data.citySlug, "pages.edit", () => Promise.resolve(ok({}))));

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
    return { ok: true as const, slug: result.industry.slug };
  });

export const Route = createFileRoute("/$citySlug/admin/industries/new")({
  loader: ({ params }) => loadNewIndustry({ data: { citySlug: params.citySlug } }),
  component: NewIndustryPage,
});

function NewIndustryPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="New industry" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/industries`}>
            Back
          </a>
        }
        title="New industry"
      />
      <IndustryForm citySlug={citySlug} />
    </section>
  );
}

function IndustryForm({
  body = "",
  citySlug,
  slug = "",
  title = "",
}: {
  body?: string;
  citySlug: string;
  slug?: string;
  title?: string;
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
          slug: String(fd.get("slug") ?? ""),
          title: String(fd.get("title") ?? ""),
        },
      });
      if (result.ok) {
        window.location.href = `/${citySlug}/admin/industries/${result.slug}`;
        return;
      }
      setStatus(result.error);
    },
    [citySlug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" defaultValue={title} name="title" placeholder="Title" required />
      <input className="field" defaultValue={slug} name="slug" placeholder="slug" required />
      <textarea
        className="field"
        defaultValue={body}
        name="body"
        placeholder="Landing page copy"
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
