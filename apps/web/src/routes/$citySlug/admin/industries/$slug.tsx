import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { getIndustry, saveIndustry } from "@/modules/pages/services/industriesService";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadIndustryInput = cityInput({ slug: z.string() });

const loadIndustry = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadIndustryInput.parse(input))
  .handler(
    cityHandler(async (page, data) => {
      const found = await getIndustry(page.store, page.actor, data.slug);
      if (!found.ok) {
        return found;
      }
      return ok({ industry: found.industry });
    }),
  );

const submitIndustryInput = cityInput({
  body: z.string(),
  slug: z.string(),
  title: z.string(),
});

const submitIndustry = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitIndustryInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      saveIndustry(page.store, page.actor, {
        body: data.body,
        slug: data.slug,
        status: "published",
        title: data.title,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/industries/$slug")({
  loader: ({ params }) => loadIndustry({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: IndustryDetailPage,
});

function IndustryDetailPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
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
}): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    submit: (fd) =>
      submitIndustry({
        data: {
          body: formString(fd, "body"),
          citySlug,
          slug,
          title: formString(fd, "title"),
        },
      }),
    successMessage: "Saved.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Title
        <input className="field" defaultValue={title} name="title" required />
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
