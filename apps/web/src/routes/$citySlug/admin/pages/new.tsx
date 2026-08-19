import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { createContentPage } from "@/modules/pages/services/pagesService";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation, type Mutated } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadNewPageInput = z.object({ citySlug: z.string().min(1) });

const loadNewPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadNewPageInput.parse(input))
  .handler(({ data }) => guarded(data.citySlug, "pages.edit", async () => ok({})));

const submitPageInput = z.object({
  citySlug: z.string().min(1),
  slug: z.string(),
  title: z.string(),
});

const submitPage = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitPageInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "pages.edit", async (page) => {
      const result = await createContentPage(page.store, page.actor, {
        blocks: [],
        slug: data.slug,
        title: data.title,
      });
      if (!result.ok) {
        return result;
      }
      return ok({ id: result.page.id });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/pages/new")({
  loader: ({ params }) => loadNewPage({ data: { citySlug: params.citySlug } }),
  component: NewPagePage,
});

function NewPagePage(): ReactElement {
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

function ContentPageForm({ citySlug }: { citySlug: string }): ReactElement {
  const navigate = useNavigate();
  const { error, handleSubmit, pending, success } = useFormSubmit<Mutated<{ id: string }>>({
    onSuccess: async (result) => {
      await navigate({
        params: { citySlug, id: result.id },
        to: "/$citySlug/admin/pages/$id",
      });
    },
    submit: (fd) =>
      submitPage({
        data: {
          citySlug,
          slug: formString(fd, "slug"),
          title: formString(fd, "title"),
        },
      }),
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Title
        <input className="field" name="title" placeholder="Title" required />
      </label>
      <label className="field-label">
        Slug
        <input className="field" name="slug" placeholder="slug" required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create page"}
      </button>
    </form>
  );
}
