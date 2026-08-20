import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { addEventResource, listEventResources } from "@/modules/events/services/eventsService";
import type { EventResourceDetail } from "@/modules/events/types";
import { hasPermission } from "@/shared/auth/permissions";
import { cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const getResourcesInput = z.object({ citySlug: z.string().min(1), slug: z.string() });

const getResources = createServerFn({ method: "GET" })
  .validator((input: unknown) => getResourcesInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { canEdit: false, event: null, resources: [] as EventResourceDetail[] };
    }
    const found = await listEventResources(page.store, data.slug);
    if (!found.ok) {
      return { canEdit: false, event: null, resources: [] as EventResourceDetail[] };
    }
    const canEdit = Boolean(
      page.actor &&
        (page.actor.isSuperAdmin || hasPermission(page.actor.permissions, "events.edit")),
    );
    return {
      canEdit,
      event: { slug: found.event.slug, title: found.event.title },
      resources: found.resources,
    };
  });

const submitResourceInput = cityInput({
  description: z.string(),
  fileUrl: z.string(),
  slug: z.string(),
  title: z.string(),
});

const submitResource = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitResourceInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      addEventResource(page.store, page.actor, data.slug, {
        description: data.description,
        fileUrl: data.fileUrl,
        title: data.title,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/events/$slug/resources")({
  loader: ({ params }) => getResources({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: EventResourcesPage,
});

function EventResourcesPage(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { slug } = Route.useParams();
  const { canEdit, event, resources } = Route.useLoaderData();

  if (!event) {
    return <EmptyCard>Event not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <Link
            className="btn"
            params={{ citySlug: tenant.slug, slug: event.slug }}
            to="/$citySlug/events/$slug"
          >
            Back to event
          </Link>
        }
        subtitle="Slides, recordings, and files from this event."
        title={`${event.title} resources`}
      />
      {canEdit ? <ResourceForm citySlug={tenant.slug} slug={slug} /> : null}
      {resources.length === 0 ? (
        <EmptyCard>No resources yet.</EmptyCard>
      ) : (
        <div className="stack">
          {resources.map((resource) => (
            <a
              className="card block"
              href={resource.fileUrl}
              key={resource.id}
              rel="noreferrer"
              target="_blank"
            >
              <strong>{resource.title}</strong>
              {resource.description ? <div className="muted">{resource.description}</div> : null}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function ResourceForm({ citySlug, slug }: { citySlug: string; slug: string }): ReactElement {
  const { error, handleSubmit, pending } = useFormSubmit({
    resetOnSuccess: true,
    submit: (fd) =>
      submitResource({
        data: {
          citySlug,
          description: formString(fd, "description"),
          fileUrl: formString(fd, "fileUrl"),
          slug,
          title: formString(fd, "title"),
        },
      }),
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Title
        <input className="field" name="title" required />
      </label>
      <label className="field-label">
        File URL
        <input className="field" name="fileUrl" placeholder="https://…" required type="url" />
      </label>
      <label className="field-label">
        Description (optional)
        <input className="field" name="description" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Adding…" : "Add resource"}
      </button>
    </form>
  );
}
