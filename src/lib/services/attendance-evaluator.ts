import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export interface Candidate {
  name: string;
  email: string;
  role: string;
  company: string;
  interests: string;
  experienceLevel: string;
}

export interface Evaluation {
  email: string;
  fitScore: number;
  reasoning: string;
  recommended: boolean;
}

const EvaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      email: z.string(),
      fitScore: z.number().describe("Score from 1 to 10"),
      reasoning: z.string(),
      recommended: z.boolean(),
    }),
  ),
});

const BATCH_SIZE = 20;

const SYSTEM_PROMPT = `You are an event attendance evaluator for a tech community. Given a description of the desired audience or event topic, evaluate each candidate's fit based on their survey answers (interests, role, experience level, company).

For each candidate, provide:
- fitScore: 1-10 score of how well they match the desired audience/topic
- reasoning: 1-2 sentences explaining the score
- recommended: true if fitScore >= 7

Return evaluations in the same order as the candidates provided.`;

function buildUserPrompt(prompt: string, candidates: Candidate[]): string {
  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (${c.email}) — Role: ${c.role}, Company: ${c.company}, Interests: ${c.interests}, Experience: ${c.experienceLevel}`,
    )
    .join("\n");

  return `Event/audience description: ${prompt}\n\nCandidates:\n${candidateList}`;
}

async function evaluateBatch(prompt: string, candidates: Candidate[]): Promise<Evaluation[]> {
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: EvaluationSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(prompt, candidates),
  });

  return object.evaluations;
}

export async function evaluateCandidates(
  prompt: string,
  candidates: Candidate[],
): Promise<Evaluation[]> {
  if (candidates.length <= BATCH_SIZE) {
    return evaluateBatch(prompt, candidates);
  }

  const batches: Candidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(batches.map((batch) => evaluateBatch(prompt, batch)));

  return results.flat();
}
