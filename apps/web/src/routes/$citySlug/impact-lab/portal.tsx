import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useState } from "react";
import { z } from "zod";

import {
  checkInParticipant,
  getPublicConfig,
} from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        config: null as {
          checkInOpen: boolean;
          coffeeNote: string;
          eventDate: string;
          eventName: string;
          eventTagline: string;
        } | null,
      };
    }
    const config = await getPublicConfig(page.registry);
    return {
      config: config.ok
        ? {
            checkInOpen: config.config.checkInOpen,
            coffeeNote: config.config.coffeeNote,
            eventDate: config.config.eventDate,
            eventName: config.config.eventName,
            eventTagline: config.config.eventTagline,
          }
        : null,
    };
  });

const checkInInput = z.object({
  citySlug: z.string().min(1),
  code: z.string(),
  email: z.string(),
  name: z.string(),
});

// Public check-in — gated by the event access code, not Clerk auth.
const checkIn = createServerFn({ method: "POST" })
  .validator((input: unknown) => checkInInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { ok: false as const, error: page.error.message ?? "City not found" };
    }
    const result = await checkInParticipant(page.registry, {
      code: data.code,
      email: data.email,
      name: data.name,
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error.message ?? result.error.code };
    }
    return {
      ok: true as const,
      coffeeCode: result.participant.coffeeCode,
      name: result.participant.name,
      sessionToken: result.sessionToken,
    };
  });

export const Route = createFileRoute("/$citySlug/impact-lab/portal")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const { config } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${tenant.slug}/impact-lab`}>
            Impact Lab
          </a>
        }
        subtitle={config?.eventTagline ?? "Check in on the day."}
        title={config?.eventName ?? "Participant portal"}
      />
      <div className="card stack">
        {config?.eventDate ? <p className="muted m-0">{config.eventDate}</p> : null}
        <p className="m-0">
          {config?.checkInOpen
            ? "Check-in is open. Enter the access code from the room screen."
            : "Check-in is closed. Find an organiser if you need help."}
        </p>
        {config?.coffeeNote ? <p className="muted">{config.coffeeNote}</p> : null}
      </div>
      <CheckInForm citySlug={tenant.slug} />
    </section>
  );
}

interface CheckInSession {
  coffeeCode: string;
  name: string;
  sessionToken: string;
}

function CheckInForm({ citySlug }: { citySlug: string }): ReactElement {
  const [session, setSession] = useState<CheckInSession | null>(null);

  const { error, handleSubmit, pending } = useFormSubmit<
    ({ ok: true } & CheckInSession) | { error: string; ok: false }
  >({
    invalidate: false,
    onSuccess: (result) =>
      setSession({
        coffeeCode: result.coffeeCode,
        name: result.name,
        sessionToken: result.sessionToken,
      }),
    submit: (fd) =>
      checkIn({
        data: {
          citySlug,
          code: formString(fd, "code"),
          email: formString(fd, "email"),
          name: formString(fd, "name"),
        },
      }),
  });

  if (session) {
    return (
      <div className="card stack">
        <strong>Checked in as {session.name}</strong>
        <p className="m-0">Coffee code: {session.coffeeCode}</p>
        <p className="muted m-0 break-all">Session token: {session.sessionToken}</p>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Check in</strong>
      <label className="field-label">
        Access code
        <input className="field" name="code" placeholder="Access code" required />
      </label>
      <label className="field-label">
        Your name
        <input className="field" name="name" placeholder="Your name" required />
      </label>
      <label className="field-label">
        Email
        <input className="field" name="email" placeholder="Email" required type="email" />
      </label>
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Checking in…" : "Check in"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
