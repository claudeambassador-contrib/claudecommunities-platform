// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as pollsRepo from "@/modules/polls/repositories/pollsRepository";
import type { PollDetail, PollInput } from "@/modules/polls/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

function parseEndsAt(value?: string | null): Result<{ endsAt: Date | null }> {
  if (!value) {
    return ok({ endsAt: null });
  }
  const endsAt = new Date(value);
  if (Number.isNaN(endsAt.getTime())) {
    return err("bad_request", 400, "endsAt must be an ISO date");
  }
  return ok({ endsAt });
}

export async function getPoll(
  store: TenantStore,
  pollId: string,
  viewer?: Actor | null,
): Promise<Result<{ poll: PollDetail }>> {
  return await pollsRepo.getPoll(store, pollId, viewer?.id);
}

export async function createPoll(
  store: TenantStore,
  actor: Actor,
  input: PollInput,
): Promise<Result<{ poll: PollDetail }>> {
  const perm = ensurePermission(actor, "posts.edit");
  if (!perm.ok) {
    return perm;
  }
  const question = input.question.trim();
  if (!question) {
    return err("bad_request", 400, "Question is required");
  }
  const options = input.options.map((option) => option.text.trim()).filter(Boolean);
  if (options.length < 2) {
    return err("bad_request", 400, "At least two options are required");
  }
  const endsAt = parseEndsAt(input.endsAt);
  if (!endsAt.ok) {
    return endsAt;
  }
  return await pollsRepo.insertPoll(store, {
    endsAt: endsAt.endsAt,
    options,
    postId: input.postId?.trim() || null,
    question,
  });
}

export async function voteOnPoll(
  store: TenantStore,
  actor: Actor,
  pollId: string,
  optionId: string,
): Promise<Result<{ success: true }>> {
  if (!optionId.trim()) {
    return err("bad_request", 400, "Option ID required");
  }
  const poll = await pollsRepo.getPoll(store, pollId);
  if (!poll.ok) {
    return poll;
  }
  if (!(await pollsRepo.optionBelongsToPoll(store, pollId, optionId.trim()))) {
    return err("bad_request", 400, "Invalid option");
  }
  return await pollsRepo.upsertVote(store, pollId, optionId.trim(), actor.id);
}
