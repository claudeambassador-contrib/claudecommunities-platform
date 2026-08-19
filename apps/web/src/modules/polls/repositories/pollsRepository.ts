import { and, asc, eq, sql } from "drizzle-orm";
import type { PollDetail } from "@/modules/polls/types";
import { first } from "@/shared/db/rows";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type PollsTables = Pick<TenantTables, "pollOptions" | "pollVotes" | "polls">;
const tables = (store: TenantStore): PollsTables => store.tables;

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

export async function getPoll(
  store: TenantStore,
  pollId: string,
  viewerId?: string,
): Promise<Result<{ poll: PollDetail }>> {
  const { pollOptions, pollVotes, polls } = tables(store);
  const poll = first(
    await store.db
      .select()
      .from(polls)
      .where(and(eq(polls.orgId, store.orgId), eq(polls.id, pollId)))
      .limit(1),
  );
  if (!poll) {
    return err("not_found", 404, "Poll not found");
  }
  const options = await store.db
    .select({
      id: pollOptions.id,
      text: pollOptions.text,
      votes: sql<number>`count(${pollVotes.id})`,
    })
    .from(pollOptions)
    .leftJoin(
      pollVotes,
      and(eq(pollVotes.optionId, pollOptions.id), eq(pollVotes.orgId, store.orgId)),
    )
    .where(and(eq(pollOptions.orgId, store.orgId), eq(pollOptions.pollId, pollId)))
    .groupBy(pollOptions.id)
    .orderBy(asc(pollOptions.sortOrder));
  const totalVotes = options.reduce((sum, option) => sum + Number(option.votes), 0);
  let userVotedOptionId: string | null = null;
  if (viewerId) {
    const vote = first(
      await store.db
        .select({ optionId: pollVotes.optionId })
        .from(pollVotes)
        .where(
          and(
            eq(pollVotes.orgId, store.orgId),
            eq(pollVotes.pollId, pollId),
            eq(pollVotes.userId, viewerId),
          ),
        )
        .limit(1),
    );
    userVotedOptionId = vote?.optionId ?? null;
  }
  return ok({
    poll: {
      endsAt: poll.endsAt ? poll.endsAt.toISOString() : null,
      hasEnded: poll.endsAt ? poll.endsAt < new Date() : false,
      id: poll.id,
      options: options.map((option) => ({
        id: option.id,
        percentage: totalVotes > 0 ? Math.round((Number(option.votes) / totalVotes) * 100) : 0,
        text: option.text,
        votes: Number(option.votes),
      })),
      question: poll.question,
      totalVotes,
      userVotedOptionId,
    },
  });
}

export async function insertPoll(
  store: TenantStore,
  input: { endsAt: Date | null; options: string[]; postId: string | null; question: string },
): Promise<Result<{ poll: PollDetail }>> {
  const { pollOptions, polls } = tables(store);
  const now = new Date();
  const id = newId("pol");
  try {
    await store.db.insert(polls).values({
      createdAt: now,
      endsAt: input.endsAt,
      id,
      orgId: store.orgId,
      postId: input.postId,
      question: input.question,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A poll already exists for this post");
    }
    throw error;
  }
  for (const [index, text] of input.options.entries()) {
    // Sequential inserts keep option order deterministic on D1.
    // biome-ignore lint/performance/noAwaitInLoops: option rows are ordered writes
    await store.db.insert(pollOptions).values({
      id: newId("opt"),
      orgId: store.orgId,
      pollId: id,
      sortOrder: index,
      text,
    });
  }
  return getPoll(store, id);
}

export async function optionBelongsToPoll(
  store: TenantStore,
  pollId: string,
  optionId: string,
): Promise<boolean> {
  const { pollOptions } = tables(store);
  const row = first(
    await store.db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(
        and(
          eq(pollOptions.orgId, store.orgId),
          eq(pollOptions.pollId, pollId),
          eq(pollOptions.id, optionId),
        ),
      )
      .limit(1),
  );
  return Boolean(row);
}

export async function upsertVote(
  store: TenantStore,
  pollId: string,
  optionId: string,
  userId: string,
): Promise<Result<{ success: true }>> {
  const { pollVotes } = tables(store);
  const now = new Date();
  const existing = first(
    await store.db
      .select()
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.orgId, store.orgId),
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.userId, userId),
        ),
      )
      .limit(1),
  );
  if (existing) {
    await store.db
      .update(pollVotes)
      .set({ optionId })
      .where(and(eq(pollVotes.orgId, store.orgId), eq(pollVotes.id, existing.id)));
    return ok({ success: true });
  }
  try {
    await store.db.insert(pollVotes).values({
      createdAt: now,
      id: newId("pvt"),
      optionId,
      orgId: store.orgId,
      pollId,
      userId,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      await store.db
        .update(pollVotes)
        .set({ optionId })
        .where(
          and(
            eq(pollVotes.orgId, store.orgId),
            eq(pollVotes.pollId, pollId),
            eq(pollVotes.userId, userId),
          ),
        );
      return ok({ success: true });
    }
    throw error;
  }
  return ok({ success: true });
}
