import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { z } from "zod";
import {
  createPreset,
  getState,
  listPresets,
  putState,
} from "@/modules/slides/services/slideGeneratorService";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { Can } from "@/shared/ui/can";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";
import { SlideCanvas } from "@/shared/ui/slide-canvas";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

function formatStateJson(data: unknown): string {
  return JSON.stringify(data ?? {}, null, 2);
}

function parseJsonField(raw: string): { error: string; ok: false } | { ok: true; value: unknown } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return {
      error: error instanceof SyntaxError ? error.message : "Invalid JSON",
      ok: false,
    };
  }
}

const loadSlideGeneratorInput = cityInput({ scope: z.string() });

const loadSlideGenerator = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadSlideGeneratorInput.parse(input))
  .handler(
    cityHandler(async (page, data) => {
      const presetsResult = await listPresets(page.store, page.actor);
      if (!presetsResult.ok) {
        return presetsResult;
      }
      const scope = data.scope.trim() || "global";
      const stateResult = await getState(page.store, page.actor, scope);
      return ok({
        presets: presetsResult.presets.map((preset) => ({
          detail: new Date(preset.updatedAt).toLocaleString(),
          id: preset.id,
          title: preset.name,
        })),
        scope,
        stateError: stateResult.ok ? null : (stateResult.error.message ?? stateResult.error.code),
        stateJson: formatStateJson(stateResult.ok ? stateResult.state.data : null),
        updatedAt: stateResult.ok ? stateResult.state.updatedAt : null,
      });
    }),
  );

const saveWorkingStateInput = cityInput({
  data: z.unknown(),
  scope: z.string(),
});

const saveWorkingState = createServerFn({ method: "POST" })
  .validator((input: unknown) => saveWorkingStateInput.parse(input))
  .handler(
    cityMutationHandler((page, data) => putState(page.store, page.actor, data.scope, data.data)),
  );

const submitPresetInput = cityInput({
  data: z.unknown(),
  name: z.string(),
});

const submitPreset = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitPresetInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      createPreset(page.store, page.actor, {
        data: data.data,
        name: data.name,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/tools/slide-generator")({
  validateSearch: (s: Record<string, unknown>) => ({
    scope: String(s.scope ?? "global").trim() || "global",
  }),
  loaderDeps: ({ search }) => ({ scope: search.scope }),
  loader: ({ deps, params }) =>
    loadSlideGenerator({ data: { citySlug: params.citySlug, scope: deps.scope } }),
  component: SlideGeneratorPage,
});

function SlideGeneratorPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Slide generator" />;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle="Visual deck editor plus JSON state and style presets."
        title="Slide generator"
      />
      <Can permission="tools.use">
        <WorkingStateForm
          citySlug={citySlug}
          key={`${data.scope}:${data.updatedAt ?? ""}:${data.stateJson}`}
          scope={data.scope}
          stateError={data.stateError}
          stateJson={data.stateJson}
          updatedAt={data.updatedAt}
        />
        <PresetForm citySlug={citySlug} />
      </Can>
      <ItemList empty="No slide presets yet." items={data.presets} />
    </section>
  );
}

function WorkingStateForm({
  citySlug,
  scope,
  stateError,
  stateJson,
  updatedAt,
}: {
  citySlug: string;
  scope: string;
  stateError: string | null;
  stateJson: string;
  updatedAt: string | null;
}): ReactElement {
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [draftJson, setDraftJson] = useState(stateJson);
  const lastSubmit = useRef<{ action: "load" | "save"; nextScope: string }>({
    action: "save",
    nextScope: scope,
  });
  const handleDraftChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setDraftJson(event.target.value),
    [],
  );

  const { error, handleSubmit, pending, success } = useFormSubmit({
    invalidate: false,
    onSuccess: async () => {
      const { action, nextScope } = lastSubmit.current;
      if (action === "load") {
        await navigate({ search: { scope: nextScope } });
        return;
      }
      if (nextScope !== scope) {
        await navigate({ search: { scope: nextScope } });
      }
      await router.invalidate();
    },
    submit: async (fd) => {
      const nextScope = formString(fd, "scope").trim() || "global";
      const action = formString(fd, "action") === "load" ? ("load" as const) : ("save" as const);
      lastSubmit.current = { action, nextScope };
      if (action === "load") {
        return { ok: true as const };
      }
      const parsed = parseJsonField(formString(fd, "data"));
      if (!parsed.ok) {
        return { error: parsed.error, ok: false as const };
      }
      return await saveWorkingState({
        data: { citySlug, data: parsed.value, scope: nextScope },
      });
    },
    successMessage: () => (lastSubmit.current.action === "save" ? "Saved." : ""),
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Scope
        <input
          className="field"
          defaultValue={scope}
          name="scope"
          placeholder="global or event:<id>"
        />
      </label>
      <SlideCanvas initialJson={stateJson} onChange={setDraftJson} />
      <label className="field-label">
        State JSON
        <textarea
          className="field w-full"
          name="data"
          onChange={handleDraftChange}
          placeholder="{}"
          rows={12}
          value={draftJson}
        />
      </label>
      {updatedAt ? <p className="muted">Updated {new Date(updatedAt).toLocaleString()}</p> : null}
      {stateError ? <p className="form-error">{stateError}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <div className="row">
        <button className="btn" disabled={pending} name="action" type="submit" value="load">
          {pending ? "Loading…" : "Load"}
        </button>
        <button
          className="btn btn-primary"
          disabled={pending}
          name="action"
          type="submit"
          value="save"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function PresetForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    resetOnSuccess: true,
    submit: async (fd) => {
      const parsed = parseJsonField(formString(fd, "data"));
      if (!parsed.ok) {
        return { error: parsed.error, ok: false as const };
      }
      return await submitPreset({
        data: {
          citySlug,
          data: parsed.value,
          name: formString(fd, "name"),
        },
      });
    },
    successMessage: "Preset created.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Preset name
        <input className="field" name="name" placeholder="Preset name" required />
      </label>
      <label className="field-label">
        Preset JSON
        <textarea
          className="field w-full"
          defaultValue="{}"
          name="data"
          placeholder="{}"
          rows={8}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create preset"}
      </button>
    </form>
  );
}
