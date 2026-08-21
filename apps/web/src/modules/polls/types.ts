export interface PollOptionInput {
  text: string;
}

export interface PollInput {
  endsAt?: string | null;
  options: PollOptionInput[];
  postId?: string | null;
  question: string;
}

export interface PollOptionDetail {
  id: string;
  percentage: number;
  text: string;
  votes: number;
}

export interface PollDetail {
  endsAt: string | null;
  hasEnded: boolean;
  id: string;
  options: PollOptionDetail[];
  question: string;
  totalVotes: number;
  userVotedOptionId: string | null;
}
