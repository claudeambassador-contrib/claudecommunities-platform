import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { addEventResource, listEventResources } from "@/modules/events/services/eventsService";
import type { EventResourceDetail } from "@/modules/events/types";
import { hasPermission } from "@/shared/auth/permissions";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const getResources = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
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

const submitResource = createServerFn({ method: "POST" })
  .validator(
    (d: { citySlug: string; description: string; fileUrl: string; slug: string; title: string }) =>
      d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await addEventResource(page.store, page.actor, data.slug, {
      description: data.description,
      fileUrl: data.fileUrl,
      title: data.title,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/events/$slug/resources")({
  loader: ({ params }) => getResources({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: EventResourcesPage,
});

function EventResourcesPage() {
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
              className="card"
              href={resource.fileUrl}
              key={resource.id}
              rel="noreferrer"
              style={{ display: "block" }}
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

function ResourceForm({ citySlug, slug }: { citySlug: string; slug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const result = await submitResource({
        data: {
          citySlug,
          description: String(fd.get("description") ?? ""),
          fileUrl: String(fd.get("fileUrl") ?? ""),
          slug,
          title: String(fd.get("title") ?? ""),
        },
      });
      if (result.ok) {
        form.reset();
        setStatus(null);
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router, slug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" name="title" placeholder="Title" required />
      <input className="field" name="fileUrl" placeholder="https://…" required type="url" />
      <input className="field" name="description" placeholder="Description (optional)" />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Add resource
      </button>
    </form>
  );
}
