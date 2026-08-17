import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_BATCH_SIZE,
  evaluateCandidates,
} from "@/modules/attendance/services/attendanceEvaluatorService";
import type { Candidate, Evaluation } from "@/modules/attendance/types";

function candidate(index: number): Candidate {
  return {
    company: "Acme",
    email: `user${index}@example.com`,
    experienceLevel: "mid",
    interests: "agents",
    name: `User ${index}`,
    role: "engineer",
  };
}

describe("evaluateCandidates", () => {
  it("rejects an empty prompt and batches large candidate lists", async () => {
    const empty = await evaluateCandidates("", [candidate(1)], {
      evaluateBatch: () => Promise.resolve([]),
    });
    expect(empty.ok).toBe(false);

    const none = await evaluateCandidates("AI meetup", [], {
      evaluateBatch: () => Promise.resolve([]),
    });
    expect(none.ok).toBe(true);
    if (none.ok) {
      expect(none.evaluations).toEqual([]);
    }

    const seen: number[] = [];
    const people = Array.from({ length: ATTENDANCE_BATCH_SIZE + 3 }, (_, index) =>
      candidate(index),
    );
    const result = await evaluateCandidates("AI meetup", people, {
      evaluateBatch: (_prompt, batch) => {
        seen.push(batch.length);
        return Promise.resolve(
          batch.map(
            (person): Evaluation => ({
              email: person.email,
              fitScore: 8,
              reasoning: "fit",
              recommended: true,
            }),
          ),
        );
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(seen).toEqual([ATTENDANCE_BATCH_SIZE, 3]);
      expect(result.evaluations).toHaveLength(people.length);
    }
  });
});
