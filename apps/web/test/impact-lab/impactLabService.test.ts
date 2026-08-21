import { describe, expect, it } from "vitest";

import {
  adminCreateTeam,
  adminDeleteTeam,
  adminUpdateSettings,
  adminUpdateTeam,
  castVote,
  checkInParticipant,
  countInterests,
  DEFAULT_ACCESS_CODE,
  DEFAULT_ADMIN_PASSWORD,
  getCoffeePoolStatus,
  getParticipantFromSession,
  getPublicConfig,
  growCoffeePool,
  joinOrCreateTeam,
  listSponsors,
  listStatements,
  loginAdmin,
  logoutAdmin,
  redeemCoffee,
  registerInterest,
  signOutBySessionToken,
  verifyAccessCode,
} from "@/modules/impact-lab/services/impactLabService";

import { openMemoryRegistry } from "../helpers/registry";

async function adminToken() {
  const store = openMemoryRegistry();
  const login = await loginAdmin(store, DEFAULT_ADMIN_PASSWORD);
  expect(login.ok).toBeTruthy();
  if (!login.ok) {
    throw new Error("login failed");
  }
  return { store, token: login.adminToken };
}

describe("impactLabService public config", () => {
  it("creates the singleton and seeds three statements without leaking secrets", async () => {
    const store = openMemoryRegistry();
    const pub = await getPublicConfig(store);
    expect(pub.ok).toBeTruthy();
    if (!pub.ok) {
      return;
    }
    expect(pub.config.eventName).toBe("Claude Impact Lab");
    expect(pub.config.checkInOpen).toBeTruthy();
    expect(pub.config.votingOpen).toBeFalsy();
    expect(pub.config).not.toHaveProperty("accessCode");
    expect(pub.config).not.toHaveProperty("adminPassword");
    expect(pub.config).not.toHaveProperty("adminToken");

    const statements = await listStatements(store);
    expect(statements.ok).toBeTruthy();
    if (!statements.ok) {
      return;
    }
    expect(statements.statements).toHaveLength(3);
    expect(statements.statements.map((s) => s.sortOrder)).toStrictEqual([0, 1, 2]);
  });
});

describe("impactLabService check-in and session", () => {
  it("rejects a wrong access code and closed check-in", async () => {
    const store = openMemoryRegistry();
    const wrong = await checkInParticipant(store, {
      code: "nope",
      email: "ada@example.com",
      name: "Ada",
    });
    expect(wrong.ok).toBeFalsy();
    if (!wrong.ok) {
      expect(wrong.error.status).toBe(401);
    }

    const verify = await verifyAccessCode(store, "nope");
    expect(verify.ok).toBeFalsy();

    const login = await loginAdmin(store, DEFAULT_ADMIN_PASSWORD);
    expect(login.ok).toBeTruthy();
    if (!login.ok) {
      return;
    }
    await adminUpdateSettings(store, login.adminToken, { checkInOpen: false });
    const closed = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "ada@example.com",
      name: "Ada",
    });
    expect(closed.ok).toBeFalsy();
    if (!closed.ok) {
      expect(closed.error.status).toBe(403);
    }
  });

  it("checks in a new participant with a coffee code and rotates returning sessions", async () => {
    const store = openMemoryRegistry();
    const first = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "Ada@Example.com",
      name: "Ada",
    });
    expect(first.ok).toBeTruthy();
    if (!first.ok) {
      return;
    }
    expect(first.participant.email).toBe("ada@example.com");
    expect(first.participant.checkedIn).toBeTruthy();
    expect(first.participant.coffeeCode.length).toBeGreaterThan(4);
    expect(first.sessionToken.length).toBeGreaterThan(8);

    const session = await getParticipantFromSession(store, first.sessionToken);
    expect(session.ok).toBeTruthy();
    if (session.ok) {
      expect(session.participant?.id).toBe(first.participant.id);
    }

    const second = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    expect(second.ok).toBeTruthy();
    if (!second.ok) {
      return;
    }
    expect(second.participant.id).toBe(first.participant.id);
    expect(second.participant.coffeeCode).toBe(first.participant.coffeeCode);
    expect(second.sessionToken).not.toBe(first.sessionToken);
    expect(second.participant.name).toBe("Ada Lovelace");

    const stale = await getParticipantFromSession(store, first.sessionToken);
    expect(stale.ok && stale.participant).toBeNull();

    await signOutBySessionToken(store, second.sessionToken);
    const signedOut = await getParticipantFromSession(store, second.sessionToken);
    expect(signedOut.ok && signedOut.participant).toBeNull();
  });

  it("assigns the next pool code when the venue pool has been grown", async () => {
    const { store, token } = await adminToken();
    const grown = await growCoffeePool(store, token, 3);
    expect(grown.ok).toBeTruthy();

    const a = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "one@example.com",
      name: "One",
    });
    const b = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "two@example.com",
      name: "Two",
    });
    expect(a.ok && b.ok).toBeTruthy();
    if (!(a.ok && b.ok)) {
      return;
    }
    expect(a.participant.coffeeCode).not.toBe(b.participant.coffeeCode);

    const status = await getCoffeePoolStatus(store, token);
    expect(status.ok).toBeTruthy();
    if (status.ok) {
      expect(status.status.total).toBe(3);
      expect(status.status.assigned).toBe(2);
      expect(status.status.unassigned).toBe(1);
    }
  });

  it("falls back to a generated code when the pool is exhausted", async () => {
    const { store, token } = await adminToken();
    await growCoffeePool(store, token, 1);
    const first = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "pool@example.com",
      name: "Pool",
    });
    const overflow = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "overflow@example.com",
      name: "Overflow",
    });
    expect(first.ok && overflow.ok).toBeTruthy();
    if (!(first.ok && overflow.ok)) {
      return;
    }
    expect(overflow.participant.coffeeCode).not.toBe(first.participant.coffeeCode);
  });
});

describe("impactLabService coffee, teams, and voting", () => {
  it("redeems coffee idempotently", async () => {
    const store = openMemoryRegistry();
    const checked = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "cup@example.com",
      name: "Cup",
    });
    expect(checked.ok).toBeTruthy();
    if (!checked.ok) {
      return;
    }
    const first = await redeemCoffee(store, checked.sessionToken);
    expect(first.ok).toBeTruthy();
    if (!first.ok) {
      return;
    }
    expect(first.coffeeRedeemed).toBeTruthy();
    expect(first.coffeeRedeemedAt).toBeTruthy();

    const again = await redeemCoffee(store, checked.sessionToken);
    expect(again.ok).toBeTruthy();
    if (again.ok) {
      expect(again.coffeeRedeemedAt).toBe(first.coffeeRedeemedAt);
    }
  });

  it("joins or creates a team case-insensitively", async () => {
    const store = openMemoryRegistry();
    const created = await joinOrCreateTeam(store, "  Table 4  ");
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.team.name).toBe("Table 4");

    const reused = await joinOrCreateTeam(store, "table 4");
    expect(reused.ok).toBeTruthy();
    if (reused.ok) {
      expect(reused.team.id).toBe(created.team.id);
    }
  });

  it("rejects votes when closed and upserts tallies when open", async () => {
    const store = openMemoryRegistry();
    const checked = await checkInParticipant(store, {
      code: DEFAULT_ACCESS_CODE,
      email: "voter@example.com",
      name: "Voter",
    });
    expect(checked.ok).toBeTruthy();
    if (!checked.ok) {
      return;
    }
    const statements = await listStatements(store);
    expect(statements.ok).toBeTruthy();
    if (!statements.ok) {
      return;
    }
    const [first, second] = statements.statements;
    if (!(first && second)) {
      throw new Error("expected seeded statements");
    }

    const closed = await castVote(store, checked.sessionToken, first.id);
    expect(closed.ok).toBeFalsy();
    if (!closed.ok) {
      expect(closed.error.status).toBe(403);
    }

    const login = await loginAdmin(store, DEFAULT_ADMIN_PASSWORD);
    expect(login.ok).toBeTruthy();
    if (!login.ok) {
      return;
    }
    await adminUpdateSettings(store, login.adminToken, { votingOpen: true });

    const unknown = await castVote(store, checked.sessionToken, "missing");
    expect(unknown.ok).toBeFalsy();
    if (!unknown.ok) {
      expect(unknown.error.status).toBe(400);
    }

    const vote = await castVote(store, checked.sessionToken, first.id);
    expect(vote.ok).toBeTruthy();
    if (vote.ok) {
      expect(vote.tallies[first.id]).toBe(1);
    }

    const switched = await castVote(store, checked.sessionToken, second.id);
    expect(switched.ok).toBeTruthy();
    if (switched.ok) {
      expect(switched.tallies[first.id] ?? 0).toBe(0);
      expect(switched.tallies[second.id]).toBe(1);
    }
  });
});

describe("impactLabService admin", () => {
  it("rejects a wrong password and rotates the admin token", async () => {
    const store = openMemoryRegistry();
    const bad = await loginAdmin(store, "wrong");
    expect(bad.ok).toBeFalsy();
    if (!bad.ok) {
      expect(bad.error.status).toBe(401);
    }

    const first = await loginAdmin(store, DEFAULT_ADMIN_PASSWORD);
    expect(first.ok).toBeTruthy();
    if (!first.ok) {
      return;
    }
    const second = await loginAdmin(store, "HACKDAY-ADMIN");
    expect(second.ok).toBeTruthy();
    if (!second.ok) {
      return;
    }
    expect(second.adminToken).not.toBe(first.adminToken);

    const stale = await adminCreateTeam(store, first.adminToken, { name: "A" });
    expect(stale.ok).toBeFalsy();
    if (!stale.ok) {
      expect(stale.error.status).toBe(401);
    }

    await logoutAdmin(store, second.adminToken);
    const after = await adminCreateTeam(store, second.adminToken, { name: "A" });
    expect(after.ok).toBeFalsy();
  });

  it("creates, updates, and deletes teams with unique names", async () => {
    const { store, token } = await adminToken();
    const created = await adminCreateTeam(store, token, { name: "Coral", tableNumber: "3" });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.team.tableNumber).toBe("3");

    const clash = await adminCreateTeam(store, token, { name: "Coral" });
    expect(clash.ok).toBeFalsy();
    if (!clash.ok) {
      expect(clash.error.status).toBe(409);
    }

    const updated = await adminUpdateTeam(store, token, created.team.id, { name: "Coral Reef" });
    expect(updated.ok).toBeTruthy();
    if (updated.ok) {
      expect(updated.team.name).toBe("Coral Reef");
    }

    const removed = await adminDeleteTeam(store, token, created.team.id);
    expect(removed.ok).toBeTruthy();
    const missing = await adminDeleteTeam(store, token, created.team.id);
    expect(missing.ok).toBeFalsy();
    if (!missing.ok) {
      expect(missing.error.status).toBe(404);
    }
  });

  it("does not grow the coffee pool past the target", async () => {
    const { store, token } = await adminToken();
    const first = await growCoffeePool(store, token, 2);
    const again = await growCoffeePool(store, token, 2);
    expect(first.ok && again.ok).toBeTruthy();
    if (first.ok && again.ok) {
      expect(first.total).toBe(2);
      expect(again.total).toBe(2);
    }
  });
});

describe("impactLabService interests", () => {
  it("registers an interest and counts without touching env", async () => {
    const store = openMemoryRegistry();
    const listed = await listSponsors(store);
    expect(listed.ok).toBeTruthy();
    if (listed.ok) {
      expect(listed.sponsors).toStrictEqual([]);
    }

    const bad = await registerInterest(store, { email: "not-an-email" });
    expect(bad.ok).toBeFalsy();

    const created = await registerInterest(store, { email: "Pat@Example.com", name: "Pat" });
    expect(created.ok).toBeTruthy();
    const counted = await countInterests(store);
    expect(counted.ok).toBeTruthy();
    if (counted.ok) {
      expect(counted.count).toBe(1);
    }
  });
});
