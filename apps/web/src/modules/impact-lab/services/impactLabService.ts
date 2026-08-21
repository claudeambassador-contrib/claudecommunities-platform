// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as repo from "@/modules/impact-lab/repositories/impactLabRepository";
import type {
  CheckInInput,
  CoffeePoolStatus,
  ConfigRow,
  ConfigWrite,
  InterestInput,
  ParticipantDetail,
  PublicConfig,
  SettingsInput,
  SponsorSummary,
  StatementDetail,
  TeamDetail,
  TeamInput,
} from "@/modules/impact-lab/types";
import type { RegistryStore } from "@/shared/db/registryStore";
import { err, ok } from "@/shared/http/errors";
import type { Empty, Result } from "@/shared/http/errors";

export const COFFEE_POOL_SIZE = 100;
export const DEFAULT_ACCESS_CODE = "IMPACTLAB";
export const DEFAULT_ADMIN_PASSWORD = "hackday-admin";

const TEAM_PALETTE = [
  "#22D3EE",
  "#34D399",
  "#4ADE80",
  "#60A5FA",
  "#A78BFA",
  "#D4836A",
  "#E879F9",
  "#F472B6",
  "#FB923C",
  "#FBBF24",
];

const COFFEE_WORDS = [
  "AFFOGATO",
  "BEAN",
  "BREW",
  "CORTADO",
  "CREMA",
  "LATTE",
  "MOCHA",
  "PICCOLO",
  "RISTRETTO",
  "ROAST",
];

export function randomTeamColor(): string {
  return TEAM_PALETTE[Math.floor(Math.random() * TEAM_PALETTE.length)] ?? "#D4836A";
}

/** Opaque, URL-safe session token. */
export function genToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Human-readable coffee redemption code, e.g. "CREMA-4827". */
export function genCoffeeCode(): string {
  const word = COFFEE_WORDS[Math.floor(Math.random() * COFFEE_WORDS.length)] ?? "BREW";
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const num = 1000 + ((arr[0] ?? 0) % 9000);
  return `${word}-${num}`;
}

export function publicConfig(config: ConfigRow): PublicConfig {
  return {
    checkInOpen: config.checkInOpen,
    coffeeNote: config.coffeeNote,
    eventDate: config.eventDate,
    eventName: config.eventName,
    eventTagline: config.eventTagline,
    peoplesChoiceOpen: config.peoplesChoiceOpen,
    peoplesChoiceWinnerTeamId: config.peoplesChoiceWinnerTeamId,
    votingOpen: config.votingOpen,
    winningStatementId: config.winningStatementId,
  };
}

export function defaultProblemStatements(): {
  description: string;
  sortOrder: number;
  summary: string;
  title: string;
}[] {
  return [
    {
      description:
        "How might smarter design of green space, canopy and public amenity make neighbourhoods more liveable for everyone — especially those most exposed to heat stress?",
      sortOrder: 0,
      summary: "Smarter green space, canopy and public amenity for the people most exposed.",
      title: "🌡️ Heat & liveability",
    },
    {
      description:
        "How might we reimagine movement across the city and surrounding suburbs so that getting around is safer, fairer and more sustainable — regardless of where you live?",
      sortOrder: 1,
      summary: "Safer, fairer, more sustainable movement — wherever you live.",
      title: "🚌 Transport & access",
    },
    {
      description:
        "How might residents and communities drive their own solutions — from circular economy models to local resource sharing — that build resilience from the ground up?",
      sortOrder: 2,
      summary: "Resilience built from the ground up by residents and communities.",
      title: "♻️ Community & citizen initiatives",
    },
  ];
}

function codeMatches(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}

function settingsToWrite(input: SettingsInput): ConfigWrite {
  const patch: ConfigWrite = {};
  if (input.accessCode !== undefined) {
    patch.accessCode = input.accessCode;
  }
  if (input.adminPassword !== undefined) {
    patch.adminPassword = input.adminPassword;
  }
  if (input.checkInOpen !== undefined) {
    patch.checkInOpen = input.checkInOpen;
  }
  if (input.coffeeNote !== undefined) {
    patch.coffeeNote = input.coffeeNote;
  }
  if (input.eventDate !== undefined) {
    patch.eventDate = input.eventDate;
  }
  if (input.eventName !== undefined) {
    patch.eventName = input.eventName;
  }
  if (input.eventTagline !== undefined) {
    patch.eventTagline = input.eventTagline;
  }
  if (input.peoplesChoiceOpen !== undefined) {
    patch.peoplesChoiceOpen = input.peoplesChoiceOpen;
  }
  if (input.peoplesChoiceWinnerTeamId !== undefined) {
    patch.peoplesChoiceWinnerTeamId = input.peoplesChoiceWinnerTeamId;
  }
  if (input.votingOpen !== undefined) {
    patch.votingOpen = input.votingOpen;
  }
  if (input.winningStatementId !== undefined) {
    patch.winningStatementId = input.winningStatementId;
  }
  return patch;
}

async function uniqueCoffeeCode(store: RegistryStore): Promise<string> {
  for (let i = 0; i < 24; i += 1) {
    const code = genCoffeeCode();
    // Sequential uniqueness checks — each candidate depends on the previous miss.
    // oxlint-disable-next-line no-await-in-loop -- uniqueness is checked one code at a time
    if (!(await repo.coffeeCodeTaken(store, code))) {
      return code;
    }
  }
  return `BREW-${genToken(3).toUpperCase()}`;
}

async function seedStarterContent(store: RegistryStore): Promise<void> {
  if ((await repo.countStatements(store)) === 0) {
    await repo.insertStatements(store, defaultProblemStatements());
  }
}

export async function getConfig(store: RegistryStore): Promise<Result<{ config: ConfigRow }>> {
  const existing = await repo.findConfig(store);
  if (existing) {
    await seedStarterContent(store);
    return ok({ config: existing });
  }
  const created = await repo.insertDefaultConfig(store);
  if (!created.ok) {
    const retry = await repo.findConfig(store);
    if (retry) {
      await seedStarterContent(store);
      return ok({ config: retry });
    }
    return created;
  }
  await seedStarterContent(store);
  return created;
}

export async function getPublicConfig(
  store: RegistryStore,
): Promise<Result<{ config: PublicConfig }>> {
  const loaded = await getConfig(store);
  if (!loaded.ok) {
    return loaded;
  }
  return ok({ config: publicConfig(loaded.config) });
}

export async function listStatements(
  store: RegistryStore,
): Promise<Result<{ statements: StatementDetail[] }>> {
  await getConfig(store);
  return ok({ statements: await repo.listStatements(store) });
}

export async function listSponsors(
  store: RegistryStore,
): Promise<Result<{ sponsors: SponsorSummary[] }>> {
  return ok({ sponsors: await repo.listSponsors(store) });
}

export async function registerInterest(
  store: RegistryStore,
  input: InterestInput,
): Promise<Result<{ id: string }>> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    return err("bad_request", 400, "A valid email is required");
  }
  return ok(await repo.insertInterest(store, { email, name: input.name }));
}

export async function countInterests(store: RegistryStore): Promise<Result<{ count: number }>> {
  return ok({ count: await repo.countInterests(store) });
}

export async function verifyAccessCode(store: RegistryStore, code: string): Promise<Result<Empty>> {
  const loaded = await getConfig(store);
  if (!loaded.ok) {
    return loaded;
  }
  if (!codeMatches(code, loaded.config.accessCode)) {
    return err("unauthenticated", 401, "That code isn't right — check the screen and try again.");
  }
  return ok({});
}

async function stampCheckIn(
  store: RegistryStore,
  participant: ParticipantDetail,
  input: { name: string; sessionToken: string; teamId: string | null },
): Promise<Result<{ participant: ParticipantDetail; sessionToken: string }>> {
  const updated = await repo.updateParticipant(store, participant.id, {
    checkedIn: true,
    checkedInAt: participant.checkedInAt ? new Date(participant.checkedInAt) : new Date(),
    name: input.name,
    sessionToken: input.sessionToken,
    teamId: input.teamId ?? participant.teamId,
  });
  if (!updated) {
    return err("internal", 500, "Failed to check in");
  }
  return ok({ participant: updated, sessionToken: input.sessionToken });
}

export async function checkInParticipant(
  store: RegistryStore,
  input: CheckInInput,
): Promise<Result<{ participant: ParticipantDetail; sessionToken: string }>> {
  const loaded = await getConfig(store);
  if (!loaded.ok) {
    return loaded;
  }
  if (!codeMatches(input.code, loaded.config.accessCode)) {
    return err("unauthenticated", 401, "Access code is no longer valid.");
  }
  if (!loaded.config.checkInOpen) {
    return err("forbidden", 403, "Check-in is closed. Please find an organiser.");
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!(name && email.includes("@"))) {
    return err("bad_request", 400, "Name and email are required");
  }
  let teamId: string | null = null;
  if (input.teamId) {
    const team = await repo.findTeam(store, input.teamId);
    teamId = team?.id ?? null;
  }
  const sessionToken = genToken();
  const existing = await repo.findParticipantByEmail(store, email);
  if (existing) {
    return stampCheckIn(store, existing, { name, sessionToken, teamId });
  }
  const created = await repo.insertParticipantWithPool(
    store,
    {
      checkedIn: true,
      checkedInAt: new Date(),
      email,
      name,
      role: "participant",
      sessionToken,
      teamId,
    },
    await uniqueCoffeeCode(store),
  );
  if (created.ok) {
    return ok({ participant: created.participant, sessionToken });
  }
  if (created.error.status === 409) {
    const raced = await repo.findParticipantByEmail(store, email);
    if (raced) {
      return stampCheckIn(store, raced, { name, sessionToken, teamId });
    }
  }
  return created;
}

export async function getParticipantFromSession(
  store: RegistryStore,
  token: string | null | undefined,
): Promise<Result<{ participant: ParticipantDetail | null }>> {
  if (!token) {
    return ok({ participant: null });
  }
  return ok({ participant: await repo.findParticipantBySession(store, token) });
}

export async function signOutBySessionToken(
  store: RegistryStore,
  token: string,
): Promise<Result<Empty>> {
  await repo.clearSession(store, token);
  return ok({});
}

export async function joinOrCreateTeam(
  store: RegistryStore,
  rawName: string,
): Promise<Result<{ team: TeamDetail }>> {
  const name = rawName.trim();
  if (!name) {
    return err("bad_request", 400, "Team name is required");
  }
  const lower = name.toLowerCase();
  const teams = await repo.listTeams(store);
  const existing = teams.find((t) => t.name.toLowerCase() === lower);
  if (existing) {
    return ok({ team: existing });
  }
  const created = await repo.insertTeam(store, { color: randomTeamColor(), name });
  if (!created.ok) {
    const retry = (await repo.listTeams(store)).find((t) => t.name.toLowerCase() === lower);
    if (retry) {
      return ok({ team: retry });
    }
    return created;
  }
  return created;
}

export async function redeemCoffee(
  store: RegistryStore,
  sessionToken: string,
): Promise<Result<{ coffeeRedeemed: true; coffeeRedeemedAt: string | null }>> {
  const session = await getParticipantFromSession(store, sessionToken);
  if (!session.ok) {
    return session;
  }
  const { participant } = session;
  if (!participant) {
    return err("unauthenticated", 401, "Not checked in");
  }
  if (participant.coffeeRedeemed) {
    return ok({
      coffeeRedeemed: true,
      coffeeRedeemedAt: participant.coffeeRedeemedAt,
    });
  }
  const redeemedAt = new Date();
  const updated = await repo.updateParticipant(store, participant.id, {
    coffeeRedeemed: true,
    coffeeRedeemedAt: redeemedAt,
  });
  return ok({
    coffeeRedeemed: true,
    coffeeRedeemedAt: updated?.coffeeRedeemedAt ?? redeemedAt.toISOString(),
  });
}

export async function castVote(
  store: RegistryStore,
  sessionToken: string,
  statementId: string,
): Promise<Result<{ statementId: string; tallies: Record<string, number> }>> {
  const loaded = await getConfig(store);
  if (!loaded.ok) {
    return loaded;
  }
  if (!loaded.config.votingOpen) {
    return err("forbidden", 403, "Voting is closed.");
  }
  const session = await getParticipantFromSession(store, sessionToken);
  if (!session.ok) {
    return session;
  }
  if (!session.participant) {
    return err("unauthenticated", 401, "Not checked in");
  }
  const statement = await repo.findStatement(store, statementId);
  if (!statement) {
    return err("bad_request", 400, "Unknown problem statement");
  }
  await repo.upsertVote(store, session.participant.id, statement.id);
  return ok({
    statementId: statement.id,
    tallies: await repo.voteTallies(store),
  });
}

export async function isPortalAdmin(
  store: RegistryStore,
  adminToken: string | null | undefined,
): Promise<boolean> {
  if (!adminToken) {
    return false;
  }
  const config = await repo.findConfig(store);
  return Boolean(config?.adminToken) && config?.adminToken === adminToken;
}

async function requireAdmin(
  store: RegistryStore,
  adminToken: string | null | undefined,
): Promise<Result<Empty>> {
  if (!(await isPortalAdmin(store, adminToken))) {
    return err("unauthenticated", 401, "Unauthorized");
  }
  return ok({});
}

export async function loginAdmin(
  store: RegistryStore,
  password: string,
): Promise<Result<{ adminToken: string }>> {
  const loaded = await getConfig(store);
  if (!loaded.ok) {
    return loaded;
  }
  if (password.trim().toLowerCase() !== loaded.config.adminPassword.trim().toLowerCase()) {
    return err("unauthenticated", 401, "Incorrect password.");
  }
  const token = genToken();
  await repo.updateConfig(store, { adminToken: token });
  return ok({ adminToken: token });
}

export async function logoutAdmin(
  store: RegistryStore,
  adminToken: string,
): Promise<Result<Empty>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  await repo.updateConfig(store, { adminToken: null });
  return ok({});
}

export async function adminCreateTeam(
  store: RegistryStore,
  adminToken: string,
  input: TeamInput,
): Promise<Result<{ team: TeamDetail }>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  const name = input.name?.trim();
  if (!name) {
    return err("bad_request", 400, "Team name is required");
  }
  return repo.insertTeam(store, {
    color: input.color || randomTeamColor(),
    name,
    tableNumber: input.tableNumber ?? null,
  });
}

export async function adminUpdateTeam(
  store: RegistryStore,
  adminToken: string,
  id: string,
  input: TeamInput,
): Promise<Result<{ team: TeamDetail }>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  return repo.updateTeam(store, id, input);
}

export async function adminDeleteTeam(
  store: RegistryStore,
  adminToken: string,
  id: string,
): Promise<Result<Empty>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  if (!(await repo.deleteTeam(store, id))) {
    return err("not_found", 404, "Team not found");
  }
  return ok({});
}

export async function adminUpdateSettings(
  store: RegistryStore,
  adminToken: string,
  input: SettingsInput,
): Promise<Result<{ config: PublicConfig }>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  if (input.winningStatementId) {
    const statement = await repo.findStatement(store, input.winningStatementId);
    if (!statement) {
      return err("bad_request", 400, "That problem statement no longer exists");
    }
  }
  if (input.peoplesChoiceWinnerTeamId) {
    const team = await repo.findTeam(store, input.peoplesChoiceWinnerTeamId);
    if (!team) {
      return err("bad_request", 400, "That team no longer exists");
    }
  }
  const updated = await repo.updateConfig(store, settingsToWrite(input));
  if (!updated) {
    return err("internal", 500, "Failed to update settings");
  }
  return ok({ config: publicConfig(updated) });
}

export async function growCoffeePool(
  store: RegistryStore,
  adminToken: string,
  target = COFFEE_POOL_SIZE,
): Promise<Result<{ total: number }>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  const current = await repo.countCoffeeCodes(store);
  if (current >= target) {
    return ok({ total: current });
  }
  const startOrder = (await repo.maxCoffeeSortOrder(store)) + 1;
  for (let i = 0; i < target - current; i += 1) {
    // Sequential inserts: each code must be unique against the growing pool.
    // oxlint-disable-next-line no-await-in-loop -- pool rows are claimed in order
    const code = await uniqueCoffeeCode(store);
    // oxlint-disable-next-line no-await-in-loop -- pool rows are claimed in order
    await repo.insertCoffeeCode(store, { code, sortOrder: startOrder + i });
  }
  return ok({ total: target });
}

export async function getCoffeePoolStatus(
  store: RegistryStore,
  adminToken: string,
): Promise<Result<{ status: CoffeePoolStatus }>> {
  const gated = await requireAdmin(store, adminToken);
  if (!gated.ok) {
    return gated;
  }
  return ok({ status: await repo.coffeePoolStatus(store) });
}
