import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { saveIndustry } from "@/modules/pages/services/industriesService";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation, type Mutated } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadNewIndustryInput = z.object({ citySlug: z.string().min(1) });

const loadNewIndustry = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadNewIndustryInput.parse(input))
  .handler(({ data }) => guarded(data.citySlug, "pages.edit", () => Promise.resolve(ok({}))));

const submitIndustryInput = z.object({
  body: z.string(),
  citySlug: z.string().min(1),
  slug: z.string(),
  title: z.string(),
});

const submitIndustry = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitIndustryInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "pages.edit", async (page) => {
      const result = await saveIndustry(page.store, page.actor, {
        body: data.body,
        slug: data.slug,
        status: "published",
        title: data.title,
      });
      if (!result.ok) {
        return result;
      }
      return ok({ slug: result.industry.slug });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/industries/new")({
  loader: ({ params }) => loadNewIndustry({ data: { citySlug: params.citySlug } }),
  component: NewIndustryPage,
});

function NewIndustryPage(): ReactElement {
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
}): ReactElement {
  const navigate = useNavigate();
  const { error, handleSubmit, pending, success } = useFormSubmit<Mutated<{ slug: string }>>({
    onSuccess: async (result) => {
      await navigate({
        params: { citySlug, slug: result.slug },
        to: "/$citySlug/admin/industries/$slug",
      });
    },
    submit: (fd) =>
      submitIndustry({
        data: {
          body: formString(fd, "body"),
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
        <input className="field" defaultValue={title} name="title" required />
      </label>
      <label className="field-label">
        Slug
        <input className="field" defaultValue={slug} name="slug" required />
      </label>
      <label className="field-label">
        Landing page copy
        <textarea className="field w-full" defaultValue={body} name="body" rows={8} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
