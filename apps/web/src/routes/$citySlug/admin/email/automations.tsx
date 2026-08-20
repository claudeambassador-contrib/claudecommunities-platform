import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createAutomation,
  listAutomations,
  setAutomationStatus,
} from "@/modules/email/services/emailOpsService";
import {
  AUTOMATION_LIVE_STATUSES,
  type AutomationDetail,
  type AutomationLiveStatus,
} from "@/modules/email/types";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const TRIGGER_OPTIONS = [
  { label: "Signup", value: "signup" },
  { label: "Event RSVP", value: "event_rsvp" },
  { label: "Manual", value: "manual" },
] as const;

const loadAutomationsInput = cityInput();

const loadAutomations = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadAutomationsInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const listed = await listAutomations(page.store, page.actor);
      if (!listed.ok) {
        return listed;
      }
      return ok({ automations: listed.automations });
    }),
  );

const submitAutomationInput = cityInput({
  name: z.string(),
  triggerType: z.string(),
});

const submitAutomation = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitAutomationInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      createAutomation(page.store, page.actor, {
        name: data.name,
        triggerType: data.triggerType,
      }),
    ),
  );

const submitAutomationStatusInput = cityInput({
  id: z.string(),
  status: z.enum(AUTOMATION_LIVE_STATUSES),
});

const submitAutomationStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitAutomationStatusInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      setAutomationStatus(page.store, page.actor, data.id, data.status),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/email/automations")({
  loader: ({ params }) => loadAutomations({ data: { citySlug: params.citySlug } }),
  component: EmailAutomationsPage,
});

function triggerLabel(triggerType: AutomationDetail["triggerType"]): string {
  return TRIGGER_OPTIONS.find((option) => option.value === triggerType)?.label ?? triggerType;
}

function EmailAutomationsPage(): ReactElement {
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

function AutomationForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    resetOnSuccess: true,
    submit: (fd) =>
      submitAutomation({
        data: {
          citySlug,
          name: formString(fd, "name"),
          triggerType: formString(fd, "triggerType"),
        },
      }),
    successMessage: "Automation created.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Name
        <input className="field" name="name" placeholder="Name" required />
      </label>
      <label className="field-label">
        Trigger
        <select className="field" defaultValue="signup" name="triggerType" required>
          {TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create automation"}
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
}): ReactElement {
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
    <div className="row mt-2">
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
