import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import {
  createPreset,
  getState,
  listPresets,
  putState,
} from "@/modules/slides/services/slideGeneratorService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { Can } from "@/shared/ui/can";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";
import { SlideCanvas } from "@/shared/ui/slide-canvas";

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

const loadSlideGenerator = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; scope: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, null, async (page) => {
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

const saveWorkingState = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; data: unknown; scope: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await putState(page.store, page.actor, data.scope, data.data);
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

const submitPreset = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; data: unknown; name: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await createPreset(page.store, page.actor, {
      data: data.data,
      name: data.name,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/tools/slide-generator")({
  validateSearch: (s: Record<string, unknown>) => ({
    scope: String(s.scope ?? "global").trim() || "global",
  }),
  loaderDeps: ({ search }) => ({ scope: search.scope }),
  loader: ({ deps, params }) =>
    loadSlideGenerator({ data: { citySlug: params.citySlug, scope: deps.scope } }),
  component: SlideGeneratorPage,
});

function SlideGeneratorPage() {
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
}) {
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(stateError);
  const [draftJson, setDraftJson] = useState(stateJson);
  const handleDraftChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setDraftJson(event.target.value),
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const nextScope = String(fd.get("scope") ?? "").trim() || "global";
      const { submitter } = event.nativeEvent as SubmitEvent;
      if (submitter instanceof HTMLButtonElement && submitter.value === "load") {
        await navigate({ search: { scope: nextScope } });
        return;
      }
      const parsed = parseJsonField(String(fd.get("data") ?? ""));
      if (!parsed.ok) {
        setStatus(parsed.error);
        return;
      }
      const result = await saveWorkingState({
        data: { citySlug, data: parsed.value, scope: nextScope },
      });
      if (result.ok) {
        setStatus("Saved.");
        if (nextScope !== scope) {
          await navigate({ search: { scope: nextScope } });
        }
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, navigate, router, scope],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input
        className="field"
        defaultValue={scope}
        name="scope"
        placeholder="global or event:<id>"
      />
      <SlideCanvas initialJson={stateJson} onChange={setDraftJson} />
      <textarea
        className="field"
        name="data"
        onChange={handleDraftChange}
        placeholder="{}"
        rows={12}
        style={{ width: "100%" }}
        value={draftJson}
      />
      {updatedAt ? <p className="muted">Updated {new Date(updatedAt).toLocaleString()}</p> : null}
      {status ? <p className="muted">{status}</p> : null}
      <div className="row">
        <button className="btn" name="action" type="submit" value="load">
          Load
        </button>
        <button className="btn btn-primary" name="action" type="submit" value="save">
          Save
        </button>
      </div>
    </form>
  );
}

function PresetForm({ citySlug }: { citySlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const parsed = parseJsonField(String(fd.get("data") ?? ""));
      if (!parsed.ok) {
        setStatus(parsed.error);
        return;
      }
      const result = await submitPreset({
        data: {
          citySlug,
          data: parsed.value,
          name: String(fd.get("name") ?? ""),
        },
      });
      if (result.ok) {
        form.reset();
        setStatus("Preset created.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" name="name" placeholder="Preset name" required />
      <textarea
        className="field"
        defaultValue="{}"
        name="data"
        placeholder="{}"
        rows={8}
        style={{ width: "100%" }}
      />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Create preset
      </button>
    </form>
  );
}
