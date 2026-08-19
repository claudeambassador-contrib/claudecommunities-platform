import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { heuristicEvaluator, parseCandidateCsv } from "@/modules/attendance/heuristic";
import { evaluateCandidates } from "@/modules/attendance/services/attendanceEvaluatorService";
import type { Evaluation } from "@/modules/attendance/types";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadPlanner = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "tools.use");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    return { allowed: true as const };
  });

const runPlanner = createServerFn({ method: "POST" })
  .validator((d: { candidates: string; citySlug: string; prompt: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const perm = ensurePermission(page.actor, "tools.use");
    if (!perm.ok) {
      return { error: perm.error.code, ok: false as const };
    }
    const candidates = parseCandidateCsv(data.candidates);
    const result = await evaluateCandidates(data.prompt, candidates, heuristicEvaluator);
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { evaluations: result.evaluations, ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/tools/attendance-planner")({
  loader: ({ params }) => loadPlanner({ data: { citySlug: params.citySlug } }),
  component: AttendancePlannerPage,
});

function AttendancePlannerPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Attendance planner" />;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle="Keyword fit against an audience description. CSV: name,email,role,company,interests,experience."
        title="Attendance planner"
      />
      <PlannerForm citySlug={citySlug} />
    </section>
  );
}

function PlannerForm({ citySlug }: { citySlug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await runPlanner({
        data: {
          candidates: String(fd.get("candidates") ?? ""),
          citySlug,
          prompt: String(fd.get("prompt") ?? ""),
        },
      });
      if (result.ok) {
        setError(null);
        setEvaluations(result.evaluations);
        return;
      }
      setEvaluations([]);
      setError(result.error);
    },
    [citySlug],
  );

  return (
    <div className="stack">
      <form className="card stack" onSubmit={handleSubmit}>
        <textarea
          className="field"
          name="prompt"
          placeholder="Audience: AI engineers in Melbourne building with Claude Code"
          required
          rows={3}
          style={{ width: "100%" }}
        />
        <textarea
          className="field"
          name="candidates"
          placeholder={"name,email,role,company,interests,experience"}
          required
          rows={8}
          style={{ width: "100%" }}
        />
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn btn-primary" type="submit">
          Rank candidates
        </button>
      </form>
      {evaluations.length === 0 ? (
        <EmptyCard>Run a ranking to see scores.</EmptyCard>
      ) : (
        <div className="stack">
          {evaluations
            .slice()
            .sort((left, right) => right.fitScore - left.fitScore)
            .map((row) => (
              <article className="card" key={row.email}>
                <strong>
                  {row.email} · {row.fitScore}
                </strong>
                <div className="muted">
                  {row.recommended ? "Recommended" : "Low fit"} · {row.reasoning}
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
