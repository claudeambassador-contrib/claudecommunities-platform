import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { createContentPage } from "@/modules/pages/services/pagesService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadNewPage = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "pages.edit");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    return { allowed: true as const };
  });

const submitPage = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; slug: string; title: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { ok: false as const, error: "unauthenticated" };
    }
    const result = await createContentPage(page.store, page.actor, {
      blocks: [],
      slug: data.slug,
      title: data.title,
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error.code };
    }
    return { ok: true as const, id: result.page.id };
  });

export const Route = createFileRoute("/$citySlug/admin/pages/new")({
  loader: ({ params }) => loadNewPage({ data: { citySlug: params.citySlug } }),
  component: NewPagePage,
});

function NewPagePage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="New page" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/pages`}>
            Back
          </a>
        }
        title="New page"
      />
      <ContentPageForm citySlug={citySlug} />
    </section>
  );
}

function ContentPageForm({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await submitPage({
        data: {
          citySlug,
          slug: String(fd.get("slug") ?? ""),
          title: String(fd.get("title") ?? ""),
        },
      });
      if (result.ok) {
        window.location.href = `/${citySlug}/admin/pages/${result.id}`;
      } else {
        setStatus(result.error);
      }
    },
    [citySlug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="btn" name="title" placeholder="Title" required style={{ width: "100%" }} />
      <input className="btn" name="slug" placeholder="slug" required style={{ width: "100%" }} />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Create page
      </button>
    </form>
  );
}
