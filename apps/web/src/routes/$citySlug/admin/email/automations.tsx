import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import {
  createAutomation,
  listAutomations,
  setAutomationStatus,
} from "@/modules/email/services/emailOpsService";
import type { AutomationDetail, AutomationLiveStatus } from "@/modules/email/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const TRIGGER_OPTIONS = [
  { label: "Signup", value: "signup" },
  { label: "Event RSVP", value: "event_rsvp" },
  { label: "Manual", value: "manual" },
] as const;

const loadAutomations = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, "email.view", async (page) => {
      const listed = await listAutomations(page.store, page.actor);
      if (!listed.ok) {
        return listed;
      }
      return ok({ automations: listed.automations });
    }),
  );

const submitAutomation = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; name: string; triggerType: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await createAutomation(page.store, page.actor, {
      name: data.name,
      triggerType: data.triggerType,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

const submitAutomationStatus = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; id: string; status: AutomationLiveStatus }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await setAutomationStatus(page.store, page.actor, data.id, data.status);
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/email/automations")({
  loader: ({ params }) => loadAutomations({ data: { citySlug: params.citySlug } }),
  component: EmailAutomationsPage,
});

function triggerLabel(triggerType: AutomationDetail["triggerType"]): string {
  return TRIGGER_OPTIONS.find((option) => option.value === triggerType)?.label ?? triggerType;
}

function EmailAutomationsPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Automations" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Catalog only — no step runner." title="Automations" />
      <Can permission="email.edit">
        <AutomationForm citySlug={citySlug} />
      </Can>
      {data.automations.length === 0 ? (
        <EmptyCard>No automations yet.</EmptyCard>
      ) : (
        <div className="stack">
          {data.automations.map((automation) => (
            <article className="card" key={automation.id}>
              <strong>{automation.name}</strong>
              <div className="muted">
                {triggerLabel(automation.triggerType)} · {automation.status}
              </div>
              <Can permission="email.edit">
                <AutomationStatusButtons automation={automation} citySlug={citySlug} />
              </Can>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AutomationForm({ citySlug }: { citySlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const result = await submitAutomation({
        data: {
          citySlug,
          name: String(fd.get("name") ?? ""),
          triggerType: String(fd.get("triggerType") ?? ""),
        },
      });
      if (result.ok) {
        form.reset();
        setStatus("Automation created.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" name="name" placeholder="Name" required />
      <select className="field" defaultValue="signup" name="triggerType" required>
        {TRIGGER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Create automation
      </button>
    </form>
  );
}

function AutomationStatusButtons({
  automation,
  citySlug,
}: {
  automation: AutomationDetail;
  citySlug: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleStatus = useCallback(
    async (next: AutomationLiveStatus) => {
      const result = await submitAutomationStatus({
        data: { citySlug, id: automation.id, status: next },
      });
      if (result.ok) {
        setStatus(null);
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [automation.id, citySlug, router],
  );
  const handlePause = useCallback(() => handleStatus("paused"), [handleStatus]);
  const handleActivate = useCallback(() => handleStatus("active"), [handleStatus]);

  return (
    <div className="row" style={{ marginTop: "0.5rem" }}>
      {automation.status === "active" ? (
        <button className="btn" onClick={handlePause} type="button">
          Pause
        </button>
      ) : (
        <button className="btn" onClick={handleActivate} type="button">
          Activate
        </button>
      )}
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
