import { describe, expect, it } from "vitest";

import { createPoll, getPoll, voteOnPoll } from "@/modules/polls/services/pollsService";

import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("pollsService", () => {
  it("creates a poll, records a single-choice vote, and lets the voter switch", async () => {
    const store = openMemoryTenant();
    const denied = await createPoll(store, memberActor(), {
      options: [{ text: "Yes" }, { text: "No" }],
      question: "Ship it?",
    });
    expect(denied.ok).toBeFalsy();

    const created = await createPoll(store, adminActor(), {
      options: [{ text: "Yes" }, { text: "No" }],
      question: "Ship it?",
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    const [yes, no] = created.poll.options;
    expect(yes && no).toBeTruthy();
    if (!(yes && no)) {
      return;
    }

    const voted = await voteOnPoll(store, memberActor(), created.poll.id, yes.id);
    expect(voted.ok).toBeTruthy();
    const first = await getPoll(store, created.poll.id, memberActor());
    expect(first.ok).toBeTruthy();
    if (first.ok) {
      expect(first.poll.userVotedOptionId).toBe(yes.id);
      expect(first.poll.totalVotes).toBe(1);
      expect(first.poll.options[0]?.votes).toBe(1);
    }

    const switched = await voteOnPoll(store, memberActor(), created.poll.id, no.id);
    expect(switched.ok).toBeTruthy();
    const second = await getPoll(store, created.poll.id, memberActor());
    expect(second.ok).toBeTruthy();
    if (second.ok) {
      expect(second.poll.userVotedOptionId).toBe(no.id);
      expect(second.poll.totalVotes).toBe(1);
      expect(second.poll.options.find((option) => option.id === no.id)?.votes).toBe(1);
    }

    const invalid = await voteOnPoll(store, memberActor(), created.poll.id, "opt_missing");
    expect(invalid.ok).toBeFalsy();
  });
});
