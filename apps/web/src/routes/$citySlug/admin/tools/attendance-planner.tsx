import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useState } from "react";
import { z } from "zod";
import { heuristicEvaluator, parseCandidateCsv } from "@/modules/attendance/heuristic";
import { evaluateCandidates } from "@/modules/attendance/services/attendanceEvaluatorService";
import type { Evaluation } from "@/modules/attendance/types";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation } from "@/shared/http/guarded";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadPlannerInput = z.object({ citySlug: z.string().min(1) });

const loadPlanner = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadPlannerInput.parse(input))
  .handler(({ data }) => guarded(data.citySlug, "tools.use", () => Promise.resolve(ok({}))));

const runPlannerInput = z.object({
  candidates: z.string(),
  citySlug: z.string().min(1),
  prompt: z.string(),
});

const runPlanner = createServerFn({ method: "POST" })
  .validator((input: unknown) => runPlannerInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "tools.use", () => {
      const candidates = parseCandidateCsv(data.candidates);
      return evaluateCandidates(data.prompt, candidates, heuristicEvaluator);
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/tools/attendance-planner")({
  loader: ({ params }) => loadPlanner({ data: { citySlug: params.citySlug } }),
  component: AttendancePlannerPage,
});

function AttendancePlannerPage(): ReactElement {
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

function PlannerForm({ citySlug }: { citySlug: string }): ReactElement {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const { error, handleSubmit, pending } = useFormSubmit({
    invalidate: false,
    submit: async (fd) => {
      const result = await runPlanner({
        data: {
          candidates: formString(fd, "candidates"),
          citySlug,
          prompt: formString(fd, "prompt"),
        },
      });
      setEvaluations(result.ok ? result.evaluations : []);
      return result;
    },
  });

  return (
    <div className="stack">
      <form className="card stack" onSubmit={handleSubmit}>
        <label className="field-label">
          Audience description
          <textarea
            className="field w-full"
            name="prompt"
            placeholder="Audience: AI engineers in Melbourne building with Claude Code"
            required
            rows={3}
          />
        </label>
        <label className="field-label">
          Candidates CSV
          <textarea
            className="field w-full"
            name="candidates"
            placeholder={"name,email,role,company,interests,experience"}
            required
            rows={8}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Ranking…" : "Rank candidates"}
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
