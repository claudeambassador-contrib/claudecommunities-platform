import type { AttendanceEvaluator, Candidate, Evaluation } from "@/modules/attendance/types";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

export const ATTENDANCE_BATCH_SIZE = 20;

export function buildUserPrompt(prompt: string, candidates: Candidate[]): string {
  const candidateList = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.name} (${candidate.email}) — Role: ${candidate.role}, Company: ${candidate.company}, Interests: ${candidate.interests}, Experience: ${candidate.experienceLevel}`,
    )
    .join("\n");
  return `Event/audience description: ${prompt}\n\nCandidates:\n${candidateList}`;
}

export async function evaluateCandidates(
  prompt: string,
  candidates: Candidate[],
  evaluator: AttendanceEvaluator,
): Promise<Result<{ evaluations: Evaluation[] }>> {
  const description = prompt.trim();
  if (!description) {
    return err("bad_request", 400, "Prompt is required");
  }
  if (candidates.length === 0) {
    return ok({ evaluations: [] });
  }
  const batches: Candidate[][] = [];
  for (let index = 0; index < candidates.length; index += ATTENDANCE_BATCH_SIZE) {
    batches.push(candidates.slice(index, index + ATTENDANCE_BATCH_SIZE));
  }
  const results = await Promise.all(
    batches.map((batch) => evaluator.evaluateBatch(description, batch)),
  );
  return ok({ evaluations: results.flat() });
}
