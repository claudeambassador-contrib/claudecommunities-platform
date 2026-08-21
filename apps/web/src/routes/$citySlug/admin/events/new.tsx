import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { createEvent } from "@/modules/events/services/eventsService";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadNewEventInput = cityInput();

const loadNewEvent = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadNewEventInput.parse(input))
  .handler(cityHandler(async () => ok({}), "events.edit"));

const submitEventInput = cityInput({
  location: z.string(),
  startTime: z.string(),
  title: z.string(),
});

const submitEvent = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitEventInput.parse(input))
  .handler(
    cityMutationHandler(async (page, data) => {
      const result = await createEvent(page.store, page.actor, {
        location: data.location || null,
        startTime: data.startTime,
        title: data.title,
      });
      if (!result.ok) {
        return result;
      }
      return ok({ slug: result.event.slug });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/events/new")({
  loader: ({ params }) => loadNewEvent({ data: { citySlug: params.citySlug } }),
  component: NewEventPage,
});

function NewEventPage(): ReactElement {
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

function EventForm({ citySlug }: { citySlug: string }): ReactElement {
  const navigate = useNavigate();
  const { error, handleSubmit, pending, success } = useFormSubmit({
    onSuccess: async () => {
      await navigate({ params: { citySlug }, to: "/$citySlug/admin/events" });
    },
    submit: (fd) =>
      submitEvent({
        data: {
          citySlug,
          location: formString(fd, "location"),
          startTime: formString(fd, "startTime"),
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
        Start time
        <input className="field" name="startTime" required type="datetime-local" />
      </label>
      <label className="field-label">
        Location
        <input className="field" name="location" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}
