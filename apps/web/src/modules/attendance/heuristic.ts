import type { AttendanceEvaluator, Candidate, Evaluation } from "@/modules/attendance/types";

const TOKEN_RE = /[^a-z0-9]+/;
const CSV_LINE_RE = /\r?\n/;
const QUOTED_CELL_RE = /^"|"$/g;

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(TOKEN_RE)
    .filter((token) => token.length > 2);
}

export function heuristicScore(prompt: string, candidate: Candidate): Evaluation {
  const haystack = [
    candidate.company,
    candidate.experienceLevel,
    candidate.interests,
    candidate.name,
    candidate.role,
  ]
    .join(" ")
    .toLowerCase();
  const words = tokens(prompt);
  const hits = words.filter((word) => haystack.includes(word));
  const fitScore = words.length === 0 ? 0 : Math.round((hits.length / words.length) * 100);
  return {
    email: candidate.email,
    fitScore,
    reasoning:
      hits.length > 0
        ? `Matched ${hits.slice(0, 6).join(", ")}`
        : "No overlapping keywords with the audience description",
    recommended: fitScore >= 40,
  };
}

export const heuristicEvaluator: AttendanceEvaluator = {
  evaluateBatch: (prompt, candidates) =>
    Promise.resolve(candidates.map((candidate) => heuristicScore(prompt, candidate))),
};

export function parseCandidateCsv(csv: string): Candidate[] {
  const lines = csv
    .split(CSV_LINE_RE)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: Candidate[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim().replace(QUOTED_CELL_RE, ""));
    const [name = "", email = "", role = "", company = "", interests = "", experience = ""] = parts;
    if (name.toLowerCase() === "name" || !email.includes("@")) {
      continue;
    }
    rows.push({
      company,
      email,
      experienceLevel: experience,
      interests,
      name: name || email,
      role,
    });
  }
  return rows;
}
