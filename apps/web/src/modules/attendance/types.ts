export interface Candidate {
  company: string;
  email: string;
  experienceLevel: string;
  interests: string;
  name: string;
  role: string;
}

export interface Evaluation {
  email: string;
  fitScore: number;
  reasoning: string;
  recommended: boolean;
}

export interface AttendanceEvaluator {
  evaluateBatch: (prompt: string, candidates: Candidate[]) => Promise<Evaluation[]>;
}
