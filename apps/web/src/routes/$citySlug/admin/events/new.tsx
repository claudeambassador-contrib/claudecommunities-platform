import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { createEvent } from "@/modules/events/services/eventsService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadNewEvent = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "events.edit");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    return { allowed: true as const };
  });

const submitEvent = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; location: string; startTime: string; title: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { ok: false as const, error: "unauthenticated" };
    }
    const result = await createEvent(page.store, page.actor, {
      location: data.location || null,
      startTime: data.startTime,
      title: data.title,
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error.code };
    }
    return { ok: true as const, slug: result.event.slug };
  });

export const Route = createFileRoute("/$citySlug/admin/events/new")({
  loader: ({ params }) => loadNewEvent({ data: { citySlug: params.citySlug } }),
  component: NewEventPage,
});

function NewEventPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="New event" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/events`}>
            Back
          </a>
        }
        title="New event"
      />
      <EventForm citySlug={citySlug} />
    </section>
  );
}

function EventForm({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await submitEvent({
        data: {
          citySlug,
          location: String(fd.get("location") ?? ""),
          startTime: String(fd.get("startTime") ?? ""),
          title: String(fd.get("title") ?? ""),
        },
      });
      if (result.ok) {
        window.location.href = `/${citySlug}/admin/events`;
      } else {
        setStatus(result.error);
      }
    },
    [citySlug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="btn" name="title" placeholder="Title" required style={{ width: "100%" }} />
      <input
        className="btn"
        name="startTime"
        required
        style={{ width: "100%" }}
        type="datetime-local"
      />
      <input className="btn" name="location" placeholder="Location" style={{ width: "100%" }} />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Create event
      </button>
    </form>
  );
}
