import { asc, count, desc, eq, isNull } from "drizzle-orm";
import type {
  CoffeePoolStatus,
  ConfigRow,
  ConfigWrite,
  ParticipantDetail,
  ParticipantRole,
  ParticipantWrite,
  PublicConfig,
  SponsorSummary,
  StatementDetail,
  TeamDetail,
  TeamInput,
} from "@/modules/impact-lab/types";
import type { RegistryStore } from "@/shared/db/registryStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

export const CONFIG_ID = "config";

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

type ConfigRecord = RegistryStore["tables"]["impactLabConfig"]["$inferSelect"];
type ParticipantRecord = RegistryStore["tables"]["impactLabParticipants"]["$inferSelect"];
type TeamRecord = RegistryStore["tables"]["impactLabTeams"]["$inferSelect"];
type StatementRecord = RegistryStore["tables"]["impactLabStatements"]["$inferSelect"];

function toPublic(row: ConfigRecord): PublicConfig {
  return {
    checkInOpen: Boolean(row.checkInOpen),
    coffeeNote: row.coffeeNote,
    eventDate: row.eventDate,
    eventName: row.eventName,
    eventTagline: row.eventTagline,
    peoplesChoiceOpen: Boolean(row.peoplesChoiceOpen),
    peoplesChoiceWinnerTeamId: row.peoplesChoiceWinnerTeamId,
    votingOpen: Boolean(row.votingOpen),
    winningStatementId: row.winningStatementId,
  };
}

function toConfig(row: ConfigRecord): ConfigRow {
  return {
    ...toPublic(row),
    accessCode: row.accessCode,
    adminPassword: row.adminPassword,
    adminToken: row.adminToken,
    id: row.id,
  };
}

function toParticipant(row: ParticipantRecord): ParticipantDetail {
  return {
    checkedIn: Boolean(row.checkedIn),
    checkedInAt: iso(row.checkedInAt),
    coffeeCode: row.coffeeCode,
    coffeeRedeemed: Boolean(row.coffeeRedeemed),
    coffeeRedeemedAt: iso(row.coffeeRedeemedAt),
    email: row.email,
    id: row.id,
    name: row.name,
    role: row.role as ParticipantRole,
    teamId: row.teamId,
  };
}

function toTeam(row: TeamRecord): TeamDetail {
  return {
    color: row.color,
    conceptRepoUrl: row.conceptRepoUrl,
    conceptSubmittedAt: iso(row.conceptSubmittedAt),
    conceptSummary: row.conceptSummary,
    conceptTitle: row.conceptTitle,
    id: row.id,
    name: row.name,
    tableNumber: row.tableNumber,
  };
}

function toStatement(row: StatementRecord): StatementDetail {
  return {
    description: row.description,
    id: row.id,
    sortOrder: row.sortOrder,
    summary: row.summary,
    title: row.title,
  };
}

export async function findConfig(store: RegistryStore): Promise<ConfigRow | null> {
  const { impactLabConfig } = store.tables;
  const row = first(
    await store.db.select().from(impactLabConfig).where(eq(impactLabConfig.id, CONFIG_ID)).limit(1),
  );
  return row ? toConfig(row) : null;
}

export async function insertDefaultConfig(
  store: RegistryStore,
): Promise<Result<{ config: ConfigRow }>> {
  const { impactLabConfig } = store.tables;
  const now = new Date();
  try {
    await store.db.insert(impactLabConfig).values({
      id: CONFIG_ID,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "Config already exists");
    }
    throw error;
  }
  const config = await findConfig(store);
  if (!config) {
    return err("internal", 500, "Failed to initialise Impact Lab config");
  }
  return ok({ config });
}

export async function updateConfig(
  store: RegistryStore,
  patch: ConfigWrite,
): Promise<ConfigRow | null> {
  const { impactLabConfig } = store.tables;
  await store.db
    .update(impactLabConfig)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(impactLabConfig.id, CONFIG_ID));
  return findConfig(store);
}

export async function listSponsors(store: RegistryStore): Promise<SponsorSummary[]> {
  const { impactLabSponsors } = store.tables;
  const rows = await store.db.select().from(impactLabSponsors);
  return rows.map((r) => ({ id: r.id, name: r.name, website: r.website }));
}

export async function insertInterest(
  store: RegistryStore,
  input: { email: string; name?: string },
): Promise<{ id: string }> {
  const { impactLabInterests } = store.tables;
  const id = newId("ili");
  await store.db.insert(impactLabInterests).values({
    createdAt: new Date(),
    email: input.email.toLowerCase(),
    id,
    name: input.name ?? null,
    orgId: null,
  });
  return { id };
}

export async function countInterests(store: RegistryStore): Promise<number> {
  const { impactLabInterests } = store.tables;
  const row = first(await store.db.select({ value: count() }).from(impactLabInterests));
  return row?.value ?? 0;
}

export async function countStatements(store: RegistryStore): Promise<number> {
  const { impactLabStatements } = store.tables;
  const row = first(await store.db.select({ value: count() }).from(impactLabStatements));
  return row?.value ?? 0;
}

export async function insertStatements(
  store: RegistryStore,
  items: { description: string; sortOrder: number; summary: string; title: string }[],
): Promise<void> {
  const { impactLabStatements } = store.tables;
  const now = new Date();
  if (items.length === 0) {
    return;
  }
  await store.db.insert(impactLabStatements).values(
    items.map((item) => ({
      createdAt: now,
      description: item.description,
      id: newId("ils"),
      sortOrder: item.sortOrder,
      summary: item.summary,
      title: item.title,
    })),
  );
}

export async function listStatements(store: RegistryStore): Promise<StatementDetail[]> {
  const { impactLabStatements } = store.tables;
  const rows = await store.db
    .select()
    .from(impactLabStatements)
    .orderBy(asc(impactLabStatements.sortOrder));
  return rows.map(toStatement);
}

export async function findStatement(
  store: RegistryStore,
  id: string,
): Promise<StatementDetail | null> {
  const { impactLabStatements } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(impactLabStatements)
      .where(eq(impactLabStatements.id, id))
      .limit(1),
  );
  return row ? toStatement(row) : null;
}

export async function findParticipantByEmail(
  store: RegistryStore,
  email: string,
): Promise<ParticipantDetail | null> {
  const { impactLabParticipants } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(impactLabParticipants)
      .where(eq(impactLabParticipants.email, email))
      .limit(1),
  );
  return row ? toParticipant(row) : null;
}

export async function findParticipantBySession(
  store: RegistryStore,
  token: string,
): Promise<ParticipantDetail | null> {
  const { impactLabParticipants } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(impactLabParticipants)
      .where(eq(impactLabParticipants.sessionToken, token))
      .limit(1),
  );
  return row ? toParticipant(row) : null;
}

export async function findParticipantById(
  store: RegistryStore,
  id: string,
): Promise<ParticipantDetail | null> {
  const { impactLabParticipants } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(impactLabParticipants)
      .where(eq(impactLabParticipants.id, id))
      .limit(1),
  );
  return row ? toParticipant(row) : null;
}

export async function coffeeCodeTaken(store: RegistryStore, code: string): Promise<boolean> {
  const { impactLabCoffeeCodes, impactLabParticipants } = store.tables;
  const [inPool, onParticipant] = await Promise.all([
    store.db
      .select({ id: impactLabCoffeeCodes.id })
      .from(impactLabCoffeeCodes)
      .where(eq(impactLabCoffeeCodes.code, code))
      .limit(1),
    store.db
      .select({ id: impactLabParticipants.id })
      .from(impactLabParticipants)
      .where(eq(impactLabParticipants.coffeeCode, code))
      .limit(1),
  ]);
  return Boolean(first(inPool) || first(onParticipant));
}

export async function findNextUnassignedCoffee(
  store: RegistryStore,
): Promise<{ code: string; id: string } | null> {
  const { impactLabCoffeeCodes } = store.tables;
  const row = first(
    await store.db
      .select({ code: impactLabCoffeeCodes.code, id: impactLabCoffeeCodes.id })
      .from(impactLabCoffeeCodes)
      .where(isNull(impactLabCoffeeCodes.participantId))
      .orderBy(asc(impactLabCoffeeCodes.sortOrder))
      .limit(1),
  );
  return row ?? null;
}

export async function insertParticipantWithPool(
  store: RegistryStore,
  input: ParticipantWrite,
  fallbackCode: string,
): Promise<Result<{ participant: ParticipantDetail }>> {
  const { impactLabCoffeeCodes, impactLabParticipants } = store.tables;
  const now = new Date();
  const id = newId("ilp");
  const entry = await findNextUnassignedCoffee(store);
  const coffeeCode = entry?.code ?? fallbackCode;
  try {
    await store.db.insert(impactLabParticipants).values({
      checkedIn: input.checkedIn ?? false,
      checkedInAt: input.checkedInAt ?? null,
      coffeeCode,
      createdAt: now,
      email: input.email,
      id,
      name: input.name,
      preRegistered: input.preRegistered ?? false,
      role: input.role ?? "participant",
      sessionToken: input.sessionToken ?? null,
      teamId: input.teamId ?? null,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "Someone with that email is already registered");
    }
    throw error;
  }
  if (entry) {
    await store.db
      .update(impactLabCoffeeCodes)
      .set({ participantId: id })
      .where(eq(impactLabCoffeeCodes.id, entry.id));
  }
  const participant = await findParticipantById(store, id);
  if (!participant) {
    return err("internal", 500, "Failed to create participant");
  }
  return ok({ participant });
}

export async function updateParticipant(
  store: RegistryStore,
  id: string,
  patch: {
    checkedIn?: boolean;
    checkedInAt?: Date | null;
    coffeeRedeemed?: boolean;
    coffeeRedeemedAt?: Date | null;
    name?: string;
    sessionToken?: string | null;
    teamId?: string | null;
  },
): Promise<ParticipantDetail | null> {
  const { impactLabParticipants } = store.tables;
  await store.db
    .update(impactLabParticipants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(impactLabParticipants.id, id));
  return findParticipantById(store, id);
}

export async function clearSession(store: RegistryStore, token: string): Promise<void> {
  const { impactLabParticipants } = store.tables;
  await store.db
    .update(impactLabParticipants)
    .set({ sessionToken: null, updatedAt: new Date() })
    .where(eq(impactLabParticipants.sessionToken, token));
}

export async function listTeams(store: RegistryStore): Promise<TeamDetail[]> {
  const { impactLabTeams } = store.tables;
  const rows = await store.db.select().from(impactLabTeams).orderBy(asc(impactLabTeams.name));
  return rows.map(toTeam);
}

export async function findTeam(store: RegistryStore, id: string): Promise<TeamDetail | null> {
  const { impactLabTeams } = store.tables;
  const row = first(
    await store.db.select().from(impactLabTeams).where(eq(impactLabTeams.id, id)).limit(1),
  );
  return row ? toTeam(row) : null;
}

export async function insertTeam(
  store: RegistryStore,
  input: { color: string; name: string; tableNumber?: string | null },
): Promise<Result<{ team: TeamDetail }>> {
  const { impactLabTeams } = store.tables;
  const id = newId("ilt");
  try {
    await store.db.insert(impactLabTeams).values({
      color: input.color,
      createdAt: new Date(),
      id,
      name: input.name,
      tableNumber: input.tableNumber ?? null,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A team with that name already exists");
    }
    throw error;
  }
  const team = await findTeam(store, id);
  if (!team) {
    return err("internal", 500, "Failed to create team");
  }
  return ok({ team });
}

export async function updateTeam(
  store: RegistryStore,
  id: string,
  input: TeamInput,
): Promise<Result<{ team: TeamDetail }>> {
  const { impactLabTeams } = store.tables;
  const existing = await findTeam(store, id);
  if (!existing) {
    return err("not_found", 404, "Team not found");
  }
  try {
    await store.db
      .update(impactLabTeams)
      .set({
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.tableNumber === undefined ? {} : { tableNumber: input.tableNumber }),
      })
      .where(eq(impactLabTeams.id, id));
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A team with that name already exists");
    }
    throw error;
  }
  const team = await findTeam(store, id);
  if (!team) {
    return err("not_found", 404, "Team not found");
  }
  return ok({ team });
}

export async function deleteTeam(store: RegistryStore, id: string): Promise<boolean> {
  const { impactLabTeams } = store.tables;
  const existing = await findTeam(store, id);
  if (!existing) {
    return false;
  }
  await store.db.delete(impactLabTeams).where(eq(impactLabTeams.id, id));
  return true;
}

export async function upsertVote(
  store: RegistryStore,
  participantId: string,
  statementId: string,
): Promise<void> {
  const { impactLabVotes } = store.tables;
  const existing = first(
    await store.db
      .select({ id: impactLabVotes.id })
      .from(impactLabVotes)
      .where(eq(impactLabVotes.participantId, participantId))
      .limit(1),
  );
  if (existing) {
    await store.db
      .update(impactLabVotes)
      .set({ statementId })
      .where(eq(impactLabVotes.id, existing.id));
    return;
  }
  await store.db.insert(impactLabVotes).values({
    createdAt: new Date(),
    id: newId("ilv"),
    participantId,
    statementId,
  });
}

export async function voteTallies(store: RegistryStore): Promise<Record<string, number>> {
  const { impactLabVotes } = store.tables;
  const rows = await store.db
    .select({
      count: count(),
      statementId: impactLabVotes.statementId,
    })
    .from(impactLabVotes)
    .groupBy(impactLabVotes.statementId);
  const tallies: Record<string, number> = {};
  for (const row of rows) {
    tallies[row.statementId] = row.count;
  }
  return tallies;
}

export async function countCoffeeCodes(store: RegistryStore): Promise<number> {
  const { impactLabCoffeeCodes } = store.tables;
  const row = first(await store.db.select({ value: count() }).from(impactLabCoffeeCodes));
  return row?.value ?? 0;
}

export async function maxCoffeeSortOrder(store: RegistryStore): Promise<number> {
  const { impactLabCoffeeCodes } = store.tables;
  const row = first(
    await store.db
      .select({ sortOrder: impactLabCoffeeCodes.sortOrder })
      .from(impactLabCoffeeCodes)
      .orderBy(desc(impactLabCoffeeCodes.sortOrder))
      .limit(1),
  );
  return row?.sortOrder ?? 0;
}

export async function insertCoffeeCode(
  store: RegistryStore,
  input: { code: string; sortOrder: number },
): Promise<void> {
  const { impactLabCoffeeCodes } = store.tables;
  await store.db.insert(impactLabCoffeeCodes).values({
    code: input.code,
    createdAt: new Date(),
    id: newId("ilc"),
    sortOrder: input.sortOrder,
  });
}

export async function coffeePoolStatus(store: RegistryStore): Promise<CoffeePoolStatus> {
  const { impactLabCoffeeCodes, impactLabParticipants } = store.tables;
  const rows = await store.db
    .select({
      coffeeRedeemed: impactLabParticipants.coffeeRedeemed,
      participantId: impactLabCoffeeCodes.participantId,
    })
    .from(impactLabCoffeeCodes)
    .leftJoin(
      impactLabParticipants,
      eq(impactLabCoffeeCodes.participantId, impactLabParticipants.id),
    );
  let assigned = 0;
  let redeemed = 0;
  for (const row of rows) {
    if (row.participantId) {
      assigned += 1;
      if (row.coffeeRedeemed) {
        redeemed += 1;
      }
    }
  }
  return {
    assigned,
    redeemed,
    total: rows.length,
    unassigned: rows.length - assigned,
  };
}

export { toPublic };
