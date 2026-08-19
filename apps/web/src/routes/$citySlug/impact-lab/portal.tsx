import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import {
  checkInParticipant,
  getPublicConfig,
} from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
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

const checkIn = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; code: string; email: string; name: string }) => d)
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

function Page() {
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
        {config?.eventDate ? (
          <p className="muted" style={{ margin: 0 }}>
            {config.eventDate}
          </p>
        ) : null}
        <p style={{ margin: 0 }}>
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

function CheckInForm({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [session, setSession] = useState<CheckInSession | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await checkIn({
        data: {
          citySlug,
          code: String(fd.get("code") ?? ""),
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? ""),
        },
      });
      if (result.ok) {
        setSession({
          coffeeCode: result.coffeeCode,
          name: result.name,
          sessionToken: result.sessionToken,
        });
        setStatus(null);
      } else {
        setStatus(result.error);
      }
    },
    [citySlug],
  );

  if (session) {
    return (
      <div className="card stack">
        <strong>Checked in as {session.name}</strong>
        <p style={{ margin: 0 }}>Coffee code: {session.coffeeCode}</p>
        <p className="muted" style={{ margin: 0, wordBreak: "break-all" }}>
          Session token: {session.sessionToken}
        </p>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Check in</strong>
      <input
        className="btn"
        name="code"
        placeholder="Access code"
        required
        style={{ width: "100%" }}
      />
      <input
        className="btn"
        name="name"
        placeholder="Your name"
        required
        style={{ width: "100%" }}
      />
      <input
        className="btn"
        name="email"
        placeholder="Email"
        required
        style={{ width: "100%" }}
        type="email"
      />
      <button className="btn btn-primary" type="submit">
        Check in
      </button>
      {status ? (
        <p className="muted" style={{ margin: 0 }}>
          {status}
        </p>
      ) : null}
    </form>
  );
}
