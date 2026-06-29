/**
 * Polls service — read poll with vote counts; toggle vote (single-choice).
 */
import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";

export interface PollDTO {
  id: string;
  question: string;
  endsAt: string | null;
  options: Array<{ id: string; text: string; votes: number; percentage: number }>;
  totalVotes: number;
  userVotedOptionId: string | null;
  hasEnded: boolean;
}

export async function getPoll(pollId: string, viewer: ActorLike | null): Promise<PollDTO> {
  const db = await getPrisma();
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { votes: true } },
          votes: viewer ? { where: { userId: viewer.id }, select: { id: true } } : false,
        },
      },
    },
  });
  if (!poll) throw new ServiceError("not_found", "Poll not found");

  const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);
  const userVotedOptionId = viewer
    ? poll.options.find((o) => (o as unknown as { votes: { id: string }[] }).votes?.length)?.id ||
      null
    : null;

  return {
    id: poll.id,
    question: poll.question,
    endsAt: poll.endsAt ? poll.endsAt.toISOString() : null,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: o._count.votes,
      percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
    })),
    totalVotes,
    userVotedOptionId,
    hasEnded: poll.endsAt ? poll.endsAt < new Date() : false,
  };
}

export async function voteOnPoll(actor: ActorLike, pollId: string, optionId: string) {
  const db = await getPrisma();
  if (!optionId) throw new ServiceError("bad_request", "Option ID required");

  const poll = await db.poll.findUnique({ where: { id: pollId }, select: { id: true } });
  if (!poll) throw new ServiceError("not_found", "Poll not found");

  const option = await db.pollOption.findFirst({
    where: { id: optionId, pollId },
    select: { id: true },
  });
  if (!option) throw new ServiceError("bad_request", "Invalid option");

  // Remove any existing vote by this user on this poll (single-choice).
  await db.pollVote.deleteMany({
    where: { userId: actor.id, option: { pollId } },
  });

  await db.pollVote.create({ data: { userId: actor.id, optionId } });
  return { success: true };
}
