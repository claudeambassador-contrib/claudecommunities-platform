/**
 * Impact Lab Hackathon Portal service.
 *
 * Self-contained day-of portal — does NOT use Clerk. Sessions are opaque
 * random tokens stored on the participant row and mirrored in an httpOnly
 * cookie. Admins use a separate password + token cookie.
 *
 * Route adapters in src/app/api/impact-lab/** should ONLY call functions
 * exported from here — no direct prisma access.
 */
import { cookies } from "next/headers";
import { getPlatformPrisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/tenant-config";
import { ServiceError } from "./_errors";

// ─── Constants ──────────────────────────────────────────────────────

export const SESSION_COOKIE = "impactlab_session";
export const ADMIN_COOKIE = "impactlab_admin";
const CONFIG_ID = "config";

export const PARTICIPANT_ROLES = ["participant", "mentor", "judge"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

const TEAM_PALETTE = [
  "#D4836A",
  "#60A5FA",
  "#4ADE80",
  "#A78BFA",
  "#F472B6",
  "#FBBF24",
  "#22D3EE",
  "#FB923C",
  "#34D399",
  "#E879F9",
];

/** Default size for the venue coffee-code pool. */
export const COFFEE_POOL_SIZE = 100;

// ─── Pure helpers ───────────────────────────────────────────────────

export function randomTeamColor(): string {
  return TEAM_PALETTE[Math.floor(Math.random() * TEAM_PALETTE.length)];
}

/** Opaque, URL-safe session token. */
export function genToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

const COFFEE_WORDS = [
  "BREW",
  "BEAN",
  "CREMA",
  "ROAST",
  "LATTE",
  "MOCHA",
  "CORTADO",
  "PICCOLO",
  "RISTRETTO",
  "AFFOGATO",
];

/** Human-readable coffee redemption code, e.g. "CREMA-4827". */
export function genCoffeeCode(): string {
  const word = COFFEE_WORDS[Math.floor(Math.random() * COFFEE_WORDS.length)];
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const num = 1000 + (arr[0] % 9000);
  return `${word}-${num}`;
}

function codeMatches(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}

function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
}

// ─── Coffee pool ────────────────────────────────────────────────────

/** Generate a coffee code that doesn't collide with any existing participant
 * OR any pool entry. Used to seed/grow the venue pool. */
export async function uniqueCoffeeCode(): Promise<string> {
  const db = await getPlatformPrisma();
  for (let i = 0; i < 24; i++) {
    const code = genCoffeeCode();
    const [pClash, poolClash] = await Promise.all([
      db.impactLabParticipant.findUnique({ where: { coffeeCode: code }, select: { id: true } }),
      db.impactLabCoffeeCode.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (!pClash && !poolClash) return code;
  }
  return `BREW-${genToken(3).toUpperCase()}`;
}

/** Status snapshot of the pool — for the admin dashboard. */
export async function getCoffeePoolStatus() {
  const db = await getPlatformPrisma();
  const codes = await db.impactLabCoffeeCode.findMany({
    orderBy: { order: "asc" },
    include: {
      participant: {
        select: {
          id: true,
          name: true,
          email: true,
          coffeeRedeemed: true,
          coffeeRedeemedAt: true,
          team: { select: { name: true } },
        },
      },
    },
  });
  let assigned = 0;
  let redeemed = 0;
  for (const c of codes) {
    if (c.participantId) {
      assigned++;
      if (c.participant?.coffeeRedeemed) redeemed++;
    }
  }
  return {
    codes,
    total: codes.length,
    assigned,
    unassigned: codes.length - assigned,
    redeemed,
  };
}

/** Add codes to the pool to reach `target`, leaving assigned rows untouched. */
export async function growCoffeePool(target = COFFEE_POOL_SIZE): Promise<number> {
  const db = await getPlatformPrisma();
  const codes = await db.impactLabCoffeeCode.findMany({
    orderBy: { order: "desc" },
    take: 1,
    select: { order: true },
  });
  const startOrder = (codes[0]?.order ?? 0) + 1;
  const current = await db.impactLabCoffeeCode.count();
  if (current >= target) return current;
  for (let i = 0; i < target - current; i++) {
    await db.impactLabCoffeeCode.create({
      data: { code: await uniqueCoffeeCode(), order: startOrder + i },
    });
  }
  return target;
}

/** Regenerate: delete all unassigned codes, then top up to `target`. */
export async function regenerateCoffeePool(target = COFFEE_POOL_SIZE) {
  const db = await getPlatformPrisma();
  const removed = await db.impactLabCoffeeCode.deleteMany({
    where: { participantId: null },
  });
  const total = await growCoffeePool(target);
  return { removed: removed.count, total };
}

/** Wipe the entire pool. Participants keep their `coffeeCode` string. */
export async function resetCoffeePool(target = COFFEE_POOL_SIZE) {
  const db = await getPlatformPrisma();
  await db.impactLabCoffeeCode.deleteMany({});
  return growCoffeePool(target);
}

interface ParticipantCreateData {
  name: string;
  email: string;
  role?: string;
  teamId?: string | null;
  preRegistered?: boolean;
  checkedIn?: boolean;
  checkedInAt?: Date | null;
  sessionToken?: string | null;
}

/** Create a participant and claim the next available pool code in one
 * transaction. Falls back to a random unique code if the pool is empty. */
export async function createParticipantWithPoolCode(input: ParticipantCreateData) {
  const db = await getPlatformPrisma();
  const fallbackCode = await uniqueCoffeeCode();
  // Global plane: ImpactLab* models are tenant-agnostic and `db` is the
  // unscoped platform client, so there is no tenant scope for this interactive
  // tx to bypass. The claim-then-create depends on the read's result, which the
  // batch $transaction([...]) form can't express — hence the interactive form.
  // eslint-disable-next-line no-restricted-syntax -- global-plane, no scope to bypass (see above)
  return db.$transaction(async (tx) => {
    const entry = await tx.impactLabCoffeeCode.findFirst({
      where: { participantId: null },
      orderBy: { order: "asc" },
      select: { id: true, code: true },
    });
    const code = entry?.code ?? fallbackCode;
    const participant = await tx.impactLabParticipant.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role ?? "participant",
        teamId: input.teamId ?? null,
        coffeeCode: code,
        preRegistered: input.preRegistered ?? false,
        checkedIn: input.checkedIn ?? false,
        checkedInAt: input.checkedInAt ?? null,
        sessionToken: input.sessionToken ?? null,
      },
    });
    if (entry) {
      await tx.impactLabCoffeeCode.update({
        where: { id: entry.id },
        data: { participantId: participant.id },
      });
    }
    return participant;
  });
}

// ─── Config / sessions ──────────────────────────────────────────────

/** Fetch the singleton config row, creating it (and seeding starter content)
 * on first access. Safe under concurrent first-requests. */
export async function getConfig() {
  const db = await getPlatformPrisma();
  const existing = await db.impactLabConfig.findUnique({ where: { id: CONFIG_ID } });
  if (existing) return existing;
  try {
    const created = await db.impactLabConfig.create({ data: { id: CONFIG_ID } });
    await seedStarterContent();
    return created;
  } catch {
    const retry = await db.impactLabConfig.findUnique({ where: { id: CONFIG_ID } });
    if (retry) return retry;
    throw new ServiceError("internal", "Failed to initialise Impact Lab config");
  }
}

export type PublicConfig = ReturnType<typeof publicConfig>;

/** Config view safe to send to the browser — secrets stripped. */
export function publicConfig(config: Awaited<ReturnType<typeof getConfig>>) {
  return {
    eventName: config.eventName,
    eventTagline: config.eventTagline,
    eventDate: config.eventDate,
    checkInOpen: config.checkInOpen,
    votingOpen: config.votingOpen,
    winningStatementId: config.winningStatementId,
    peoplesChoiceOpen: config.peoplesChoiceOpen,
    peoplesChoiceWinnerTeamId: config.peoplesChoiceWinnerTeamId,
    coffeeNote: config.coffeeNote,
  };
}

export type PortalParticipant = NonNullable<Awaited<ReturnType<typeof getParticipantFromSession>>>;

/** Resolve the checked-in participant for the current request, or null. */
export async function getParticipantFromSession() {
  const db = await getPlatformPrisma();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return db.impactLabParticipant.findUnique({
    where: { sessionToken: token },
    include: { team: true, vote: true, peoplesChoiceVote: true },
  });
}

/** True when the current request carries a valid admin cookie. */
export async function isPortalAdmin(): Promise<boolean> {
  const db = await getPlatformPrisma();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const config = await db.impactLabConfig.findUnique({
    where: { id: CONFIG_ID },
    select: { adminToken: true },
  });
  const dbToken = config?.adminToken;
  return Boolean(dbToken) && dbToken === token;
}

/** Find an existing team by name (case-insensitive) or create it. SQLite has
 * no Prisma-side case-insensitive mode, so we filter client-side — the team
 * set is small (one event's worth, ~30 max). */
export async function joinOrCreateTeam(rawName: string) {
  const name = rawName.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  const db = await getPlatformPrisma();
  const teams = await db.impactLabTeam.findMany();
  const existing = teams.find((t) => t.name.toLowerCase() === lower);
  if (existing) return existing;
  return db.impactLabTeam.create({
    data: { name, color: randomTeamColor() },
  });
}

// ─── Default content seeds ──────────────────────────────────────────

export async function seedStarterContent() {
  const db = await getPlatformPrisma();
  const statementCount = await db.impactLabProblemStatement.count();
  if (statementCount === 0) {
    await db.impactLabProblemStatement.createMany({ data: defaultProblemStatements() });
  }
  const scheduleCount = await db.impactLabScheduleItem.count();
  if (scheduleCount === 0) {
    await db.impactLabScheduleItem.createMany({ data: defaultSchedule() });
  }
  const resourceCount = await db.impactLabResource.count();
  if (resourceCount === 0) {
    const config = await getTenantConfig();
    await db.impactLabResource.createMany({
      data: defaultResources({
        discordCommunityInvite: config.discordCommunityInvite,
        communityName: config.communityName,
        siteUrl: config.siteUrl,
      }),
    });
  }
}

/** Theme: Urban resilience — building liveable neighbourhoods for everyone. */
export function defaultProblemStatements() {
  return [
    {
      title: "🌡️ Heat & liveability",
      summary: "Smarter green space, canopy and public amenity for the people most exposed.",
      description:
        "How might smarter design of green space, canopy and public amenity make neighbourhoods more liveable for everyone — especially those most exposed to heat stress?",
      order: 0,
    },
    {
      title: "🚌 Transport & access",
      summary: "Safer, fairer, more sustainable movement — wherever you live.",
      description:
        "How might we reimagine movement across the city and surrounding suburbs so that getting around is safer, fairer and more sustainable — regardless of where you live?",
      order: 1,
    },
    {
      title: "♻️ Community & citizen initiatives",
      summary: "Resilience built from the ground up by residents and communities.",
      description:
        "How might residents and communities drive their own solutions — from circular economy models to local resource sharing — that build resilience from the ground up?",
      order: 2,
    },
  ];
}

export function defaultSchedule() {
  return [
    {
      startTime: "8:00 AM",
      title: "Arrive & meet your team",
      description: "Coffee, snacks, find your table and say hi.",
      order: 0,
    },
    {
      startTime: "9:00 AM",
      title: "Welcome",
      description: "Quick intro to the day from the Claude Community team.",
      order: 1,
    },
    {
      startTime: "9:10 AM",
      title: "Anthropic kickoff talk",
      description: "Short talk from Anthropic, on screen.",
      order: 2,
    },
    {
      startTime: "9:30 AM",
      title: "Team huddle",
      description: "Meet your team — backgrounds, skills, who plays what role.",
      order: 3,
    },
    {
      startTime: "9:40 AM",
      title: "Challenge options",
      description: "Three problem statements get put on the table.",
      order: 4,
    },
    {
      startTime: "9:45 AM",
      title: "Vote on the challenge",
      description: "Every team picks their favourite. Most votes wins.",
      order: 5,
    },
    {
      startTime: "9:50 AM",
      title: "Challenge announced",
      description: "The winning problem is locked in. Reverse pitches from the room if useful.",
      order: 6,
    },
    {
      startTime: "9:55 AM",
      title: "Design your solution",
      description: "Plan the direction of your hack before you start building.",
      order: 7,
    },
    {
      startTime: "10:20 AM",
      title: "Sprint 1",
      description: "Heads down — first build sprint.",
      order: 8,
    },
    {
      startTime: "11:00 AM",
      title: "Morning tea",
      description: "Coffee, fruit, snacks. Reset.",
      order: 9,
    },
    { startTime: "11:15 AM", title: "Sprint 2", description: "Keep building.", order: 10 },
    {
      startTime: "11:55 AM",
      title: "Sprint 3",
      description: "Mentor check-ins on the floor — including the Divergent Kind coherence lens.",
      order: 11,
    },
    {
      startTime: "12:35 PM",
      title: "Lunch",
      description: "Food provided. Keep talking to your team.",
      order: 12,
    },
    { startTime: "1:10 PM", title: "Sprint 4", description: "Afternoon build begins.", order: 13 },
    {
      startTime: "2:00 PM",
      title: "Sprint 5",
      description: "Push toward a working demo.",
      order: 14,
    },
    {
      startTime: "2:40 PM",
      title: "Afternoon tea",
      description: "Coffee, fruit, snacks.",
      order: 15,
    },
    { startTime: "3:00 PM", title: "Sprint 6", description: "Final build window.", order: 16 },
    {
      startTime: "3:30 PM",
      title: "Pitch prep guidance",
      description: "How to shape your pitch — what the judges are listening for.",
      order: 17,
    },
    {
      startTime: "4:00 PM",
      title: "Hack ends",
      description: "Stop building. Prepare your pitch.",
      order: 18,
    },
    { startTime: "4:10 PM", title: "Pitches begin", description: "Each team presents.", order: 19 },
    { startTime: "5:10 PM", title: "Judging", description: "Panel deliberation.", order: 20 },
    {
      startTime: "5:30 PM",
      title: "Winners announced",
      description: "Awards, drinks, photos. Includes the Coherence Award by Divergent Kind.",
      order: 21,
    },
    {
      startTime: "6:00 PM",
      title: "Wrap",
      description: "That's a wrap. See you in the Discord.",
      order: 22,
    },
  ];
}

export function defaultResources(ctx: {
  discordCommunityInvite: string;
  communityName: string;
  siteUrl: string;
}) {
  return [
    {
      title: "Claude — $70 API credits",
      description: "Claim your credits before you start building.",
      url: "https://claude.com/offers?offer_code=fa0ba627-bea1-4602-9974-b90b0b59dd00",
      category: "Build",
      order: 0,
    },
    {
      title: "Anthropic API docs",
      description: "Reference for building with the Claude API.",
      url: "https://docs.anthropic.com",
      category: "Build",
      order: 1,
    },
    {
      title: "Claude Code docs",
      description: "Everything you need to drive Claude Code.",
      url: "https://code.claude.com/docs",
      category: "Build",
      order: 2,
    },
    {
      title: "Vic Gov Open Data",
      description: "Victorian Government open datasets.",
      url: "https://www.data.vic.gov.au/",
      category: "Data",
      order: 3,
    },
    {
      title: "City of Melbourne Open Data",
      description: "Council-level open data for the city.",
      url: "https://data.melbourne.vic.gov.au/pages/home/",
      category: "Data",
      order: 4,
    },
    {
      title: "Glow Data",
      description: "Sustainability demand signals from 12,000+ Australians.",
      url: "https://campaign.glowfeed.com/claude-impact-lab/",
      category: "Data",
      order: 5,
    },
    {
      title: "The Coherence Award by Divergent Kind",
      description:
        "Recognising the team whose tool best holds the four-dimension Civic Coherence Lens — Agency, Reciprocity, Alignment, Signal Integrity.",
      url: "https://divergentkind.com.au",
      category: "Awards",
      order: 6,
    },
    {
      title: "Civic Coherence Lens (Claude Skill)",
      description:
        "Optional Skill from Divergent Kind — install it and self-check your tool against the four dimensions.",
      url: "https://github.com/divergentkind/civic-coherence-lens",
      category: "Awards",
      order: 7,
    },
    {
      title: "Claude Community Discord",
      description: "Join the conversation — share what you built, find collaborators.",
      url: ctx.discordCommunityInvite,
      category: "Community",
      order: 8,
    },
    {
      title: ctx.communityName,
      description: "The community behind the Impact Lab.",
      url: ctx.siteUrl,
      category: "Community",
      order: 9,
    },
  ];
}

// ─── Participant-facing service functions ───────────────────────────

/** Verify the access code in the gate — throws on mismatch. */
export async function verifyAccessCode(code: string): Promise<void> {
  const config = await getConfig();
  if (!codeMatches(code, config.accessCode)) {
    throw new ServiceError(
      "unauthenticated",
      "That code isn't right — check the screen and try again.",
    );
  }
}

interface CheckInInput {
  code: string;
  name: string;
  email: string;
  teamId?: string;
}

/** Check a participant in. Returns the rotated session token for cookie. */
export async function checkInParticipant(input: CheckInInput): Promise<string> {
  const db = await getPlatformPrisma();
  const config = await getConfig();
  if (!codeMatches(input.code, config.accessCode)) {
    throw new ServiceError("unauthenticated", "Access code is no longer valid.");
  }
  if (!config.checkInOpen) {
    throw new ServiceError("forbidden", "Check-in is closed. Please find an organiser.");
  }

  let pickedTeamId: string | null = null;
  if (input.teamId) {
    const team = await db.impactLabTeam.findUnique({
      where: { id: input.teamId },
      select: { id: true },
    });
    pickedTeamId = team?.id ?? null;
  }

  const normEmail = input.email.toLowerCase();
  const token = genToken();
  const existing = await db.impactLabParticipant.findUnique({ where: { email: normEmail } });

  if (existing) {
    await db.impactLabParticipant.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        checkedIn: true,
        checkedInAt: existing.checkedInAt ?? new Date(),
        sessionToken: token,
        teamId: pickedTeamId ?? existing.teamId,
      },
    });
  } else {
    await createParticipantWithPoolCode({
      name: input.name,
      email: normEmail,
      role: "participant",
      teamId: pickedTeamId,
      checkedIn: true,
      checkedInAt: new Date(),
      sessionToken: token,
    });
  }

  return token;
}

/** Clear the session token for the cookie-supplied session. */
export async function signOutBySessionToken(token: string): Promise<void> {
  const db = await getPlatformPrisma();
  await db.impactLabParticipant
    .updateMany({ where: { sessionToken: token }, data: { sessionToken: null } })
    .catch(() => {});
}

/** Record a vote (idempotent upsert). Returns updated tally per statement. */
export async function castVote(
  participant: PortalParticipant,
  statementId: string,
): Promise<{ statementId: string; tallies: Record<string, number> }> {
  const db = await getPlatformPrisma();
  const config = await getConfig();
  if (!config.votingOpen) {
    throw new ServiceError("forbidden", "Voting is closed.");
  }
  const statement = await db.impactLabProblemStatement.findUnique({
    where: { id: statementId },
    select: { id: true },
  });
  if (!statement) {
    throw new ServiceError("bad_request", "Unknown problem statement");
  }
  await db.impactLabVote.upsert({
    where: { participantId: participant.id },
    update: { statementId: statement.id },
    create: { participantId: participant.id, statementId: statement.id },
  });
  const grouped = await db.impactLabVote.groupBy({
    by: ["statementId"],
    _count: { statementId: true },
  });
  const tallies: Record<string, number> = {};
  for (const row of grouped) tallies[row.statementId] = row._count.statementId;
  return { statementId: statement.id, tallies };
}

/** Mark the participant's coffee as redeemed (idempotent). */
export async function redeemCoffee(participant: PortalParticipant): Promise<{
  coffeeRedeemed: true;
  coffeeRedeemedAt: string | null;
}> {
  if (participant.coffeeRedeemed) {
    return {
      coffeeRedeemed: true,
      coffeeRedeemedAt: participant.coffeeRedeemedAt?.toISOString() ?? null,
    };
  }
  const db = await getPlatformPrisma();
  const redeemedAt = new Date();
  await db.impactLabParticipant.update({
    where: { id: participant.id },
    data: { coffeeRedeemed: true, coffeeRedeemedAt: redeemedAt },
  });
  return { coffeeRedeemed: true, coffeeRedeemedAt: redeemedAt.toISOString() };
}

/** Rename the participant's team. */
export async function renameOwnTeam(
  participant: PortalParticipant,
  name: string,
): Promise<{ name: string }> {
  if (!participant.teamId) {
    throw new ServiceError("bad_request", "You're not on a team yet — an organiser can place you.");
  }
  const db = await getPlatformPrisma();
  try {
    const team = await db.impactLabTeam.update({
      where: { id: participant.teamId },
      data: { name },
    });
    return { name: team.name };
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ServiceError(
        "bad_request",
        "Another team already has that name — try a different one.",
      );
    }
    throw e;
  }
}

/** Submit / update the team's concept. Empty `summary` preserves the
 * existing one — teams late in the day often just lock in a solution
 * name for the People's Choice vote without rewriting the description.
 * `repoUrl`: undefined leaves existing alone, empty string clears it,
 * non-empty overwrites. */
export async function submitOwnConcept(
  participant: PortalParticipant,
  title: string,
  summary: string,
  extras: { repoUrl?: string } = {},
): Promise<{
  conceptTitle: string | null;
  conceptSummary: string | null;
  conceptRepoUrl: string | null;
  conceptSubmittedAt: string;
}> {
  if (!participant.teamId) {
    throw new ServiceError("bad_request", "You're not on a team yet — an organiser can place you.");
  }
  const db = await getPlatformPrisma();
  const submittedAt = new Date();
  const team = await db.impactLabTeam.update({
    where: { id: participant.teamId },
    data: {
      conceptTitle: title,
      ...(summary ? { conceptSummary: summary } : {}),
      ...(extras.repoUrl !== undefined ? { conceptRepoUrl: extras.repoUrl || null } : {}),
      conceptSubmittedAt: submittedAt,
    },
  });
  return {
    conceptTitle: team.conceptTitle,
    conceptSummary: team.conceptSummary,
    conceptRepoUrl: team.conceptRepoUrl,
    conceptSubmittedAt: submittedAt.toISOString(),
  };
}

// ─── Admin auth ─────────────────────────────────────────────────────

/** Verify the admin password (case-insensitive) and rotate the admin token.
 * Returns the new token for the route to set on cookie. */
export async function loginAdmin(password: string): Promise<string> {
  const config = await getConfig();
  if (password.trim().toLowerCase() !== config.adminPassword.trim().toLowerCase()) {
    throw new ServiceError("unauthenticated", "Incorrect password.");
  }
  const db = await getPlatformPrisma();
  const token = genToken();
  await db.impactLabConfig.update({
    where: { id: config.id },
    data: { adminToken: token },
  });
  return token;
}

/** Clear the admin token (signs out every admin device). */
export async function logoutAdmin(): Promise<void> {
  const db = await getPlatformPrisma();
  const config = await getConfig();
  await db.impactLabConfig.update({
    where: { id: config.id },
    data: { adminToken: null },
  });
}

/** Throws 401 if the current request is not an admin. */
export async function requirePortalAdmin(): Promise<void> {
  if (!(await isPortalAdmin())) {
    throw new ServiceError("unauthenticated", "Unauthorized");
  }
}

// ─── Admin CRUD ─────────────────────────────────────────────────────

interface TeamInput {
  name?: string;
  color?: string;
  tableNumber?: string | null;
}

export async function adminCreateTeam(input: TeamInput) {
  if (!input.name) throw new ServiceError("bad_request", "Team name is required");
  const db = await getPlatformPrisma();
  try {
    return await db.impactLabTeam.create({
      data: {
        name: input.name,
        color: input.color || randomTeamColor(),
        tableNumber: input.tableNumber ?? null,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ServiceError("conflict", "A team with that name already exists");
    }
    throw e;
  }
}

export async function adminUpdateTeam(id: string, input: TeamInput) {
  const db = await getPlatformPrisma();
  try {
    return await db.impactLabTeam.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.tableNumber !== undefined ? { tableNumber: input.tableNumber } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ServiceError("conflict", "A team with that name already exists");
    }
    throw e;
  }
}

export async function adminDeleteTeam(id: string): Promise<void> {
  const db = await getPlatformPrisma();
  await db.impactLabTeam.delete({ where: { id } });
}

interface AdminParticipantInput {
  name?: string;
  email?: string;
  role?: ParticipantRole;
  teamId?: string | null;
}

export async function adminCreateParticipant(input: AdminParticipantInput) {
  if (!input.name || !input.email) {
    throw new ServiceError("bad_request", "Name and email are required");
  }
  try {
    return await createParticipantWithPoolCode({
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role || "participant",
      teamId: input.teamId || null,
      preRegistered: true,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ServiceError("conflict", "Someone with that email is already registered");
    }
    throw e;
  }
}

export async function adminUpdateParticipant(id: string, input: AdminParticipantInput) {
  const db = await getPlatformPrisma();
  return db.impactLabParticipant.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId || null } : {}),
    },
  });
}

export async function adminDeleteParticipant(id: string): Promise<void> {
  const db = await getPlatformPrisma();
  await db.impactLabParticipant.delete({ where: { id } });
}

interface StatementInput {
  title?: string;
  summary?: string;
  description?: string;
  order?: number;
}

export async function adminCreateStatement(input: StatementInput) {
  if (!input.title || !input.summary || !input.description) {
    throw new ServiceError("bad_request", "Title, summary and description are required");
  }
  const db = await getPlatformPrisma();
  return db.impactLabProblemStatement.create({
    data: {
      title: input.title,
      summary: input.summary,
      description: input.description,
      order: input.order ?? 0,
    },
  });
}

export async function adminUpdateStatement(id: string, input: StatementInput) {
  const db = await getPlatformPrisma();
  return db.impactLabProblemStatement.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function adminDeleteStatement(id: string): Promise<void> {
  const db = await getPlatformPrisma();
  await db.impactLabProblemStatement.delete({ where: { id } });
  // Clear winner if it pointed at the deleted statement.
  await db.impactLabConfig.updateMany({
    where: { id: CONFIG_ID, winningStatementId: id },
    data: { winningStatementId: null },
  });
}

interface ScheduleInput {
  startTime?: string;
  title?: string;
  description?: string | null;
  track?: string | null;
  order?: number;
}

export async function adminCreateScheduleItem(input: ScheduleInput) {
  if (!input.startTime || !input.title) {
    throw new ServiceError("bad_request", "Time and title are required");
  }
  const db = await getPlatformPrisma();
  return db.impactLabScheduleItem.create({
    data: {
      startTime: input.startTime,
      title: input.title,
      description: input.description ?? null,
      track: input.track ?? null,
      order: input.order ?? 0,
    },
  });
}

export async function adminUpdateScheduleItem(id: string, input: ScheduleInput) {
  const db = await getPlatformPrisma();
  return db.impactLabScheduleItem.update({
    where: { id },
    data: {
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.track !== undefined ? { track: input.track } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function adminDeleteScheduleItem(id: string): Promise<void> {
  const db = await getPlatformPrisma();
  await db.impactLabScheduleItem.delete({ where: { id } });
}

interface ResourceInput {
  title?: string;
  description?: string | null;
  url?: string;
  category?: string;
  order?: number;
}

export async function adminCreateResource(input: ResourceInput) {
  if (!input.title || !input.url) {
    throw new ServiceError("bad_request", "Title and link are required");
  }
  const db = await getPlatformPrisma();
  return db.impactLabResource.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      url: input.url,
      category: input.category || "General",
      order: input.order ?? 0,
    },
  });
}

export async function adminUpdateResource(id: string, input: ResourceInput) {
  const db = await getPlatformPrisma();
  return db.impactLabResource.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function adminDeleteResource(id: string): Promise<void> {
  const db = await getPlatformPrisma();
  await db.impactLabResource.delete({ where: { id } });
}

interface SettingsInput {
  eventName?: string;
  eventTagline?: string;
  eventDate?: string;
  accessCode?: string;
  adminPassword?: string;
  coffeeNote?: string;
  checkInOpen?: boolean;
  votingOpen?: boolean;
  winningStatementId?: string | null;
  peoplesChoiceOpen?: boolean;
  peoplesChoiceWinnerTeamId?: string | null;
}

export async function adminUpdateSettings(input: SettingsInput) {
  const db = await getPlatformPrisma();
  if (input.winningStatementId) {
    const exists = await db.impactLabProblemStatement.findUnique({
      where: { id: input.winningStatementId },
      select: { id: true },
    });
    if (!exists) {
      throw new ServiceError("bad_request", "That problem statement no longer exists");
    }
  }
  if (input.peoplesChoiceWinnerTeamId) {
    const team = await db.impactLabTeam.findUnique({
      where: { id: input.peoplesChoiceWinnerTeamId },
      select: { id: true },
    });
    if (!team) {
      throw new ServiceError("bad_request", "That team no longer exists");
    }
  }
  const config = await db.impactLabConfig.update({
    where: { id: CONFIG_ID },
    data: {
      ...(input.eventName !== undefined ? { eventName: input.eventName } : {}),
      ...(input.eventTagline !== undefined ? { eventTagline: input.eventTagline } : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
      ...(input.accessCode !== undefined ? { accessCode: input.accessCode } : {}),
      ...(input.adminPassword !== undefined ? { adminPassword: input.adminPassword } : {}),
      ...(input.coffeeNote !== undefined ? { coffeeNote: input.coffeeNote } : {}),
      ...(input.checkInOpen !== undefined ? { checkInOpen: input.checkInOpen } : {}),
      ...(input.votingOpen !== undefined ? { votingOpen: input.votingOpen } : {}),
      ...(input.winningStatementId !== undefined
        ? { winningStatementId: input.winningStatementId || null }
        : {}),
      ...(input.peoplesChoiceOpen !== undefined
        ? { peoplesChoiceOpen: input.peoplesChoiceOpen }
        : {}),
      ...(input.peoplesChoiceWinnerTeamId !== undefined
        ? { peoplesChoiceWinnerTeamId: input.peoplesChoiceWinnerTeamId || null }
        : {}),
    },
  });
  return {
    eventName: config.eventName,
    eventTagline: config.eventTagline,
    eventDate: config.eventDate,
    accessCode: config.accessCode,
    coffeeNote: config.coffeeNote,
    checkInOpen: config.checkInOpen,
    votingOpen: config.votingOpen,
    winningStatementId: config.winningStatementId,
    peoplesChoiceOpen: config.peoplesChoiceOpen,
    peoplesChoiceWinnerTeamId: config.peoplesChoiceWinnerTeamId,
  };
}

// ─── People's Choice award ──────────────────────────────────────────

/** Tally of votes per team. D1 has no Hyperdrive caching, so a plain
 * groupBy is consistent without raw-SQL gymnastics. */
async function peoplesChoiceTallies(): Promise<Record<string, number>> {
  const db = await getPlatformPrisma();
  const rows = await db.impactLabTeamVote.groupBy({
    by: ["teamId"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.teamId] = r._count._all;
  return out;
}

export async function getPeoplesChoiceState() {
  const config = await getConfig();
  const tallies = await peoplesChoiceTallies();
  return {
    open: config.peoplesChoiceOpen,
    winnerTeamId: config.peoplesChoiceWinnerTeamId,
    tallies,
  };
}

export async function recordPeoplesChoiceVote(input: {
  participant: PortalParticipant;
  teamId: string;
}) {
  const db = await getPlatformPrisma();
  const config = await getConfig();
  if (!config.peoplesChoiceOpen) {
    throw new ServiceError("forbidden", "People's Choice voting isn't open yet.");
  }
  const team = await db.impactLabTeam.findUnique({
    where: { id: input.teamId },
    select: { id: true },
  });
  if (!team) throw new ServiceError("bad_request", "Unknown team");
  if (input.participant.teamId && input.participant.teamId === team.id) {
    throw new ServiceError("bad_request", "Vote for someone else's team — not your own.");
  }
  await db.impactLabTeamVote.upsert({
    where: { participantId: input.participant.id },
    update: { teamId: team.id },
    create: { participantId: input.participant.id, teamId: team.id },
  });
  return { teamId: team.id, tallies: await peoplesChoiceTallies() };
}

interface ImportRow {
  name?: string;
  email: string;
  role?: string;
  team?: string;
}

export async function adminBulkImportParticipants(rows: ImportRow[]) {
  const db = await getPlatformPrisma();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const validRoles = PARTICIPANT_ROLES as readonly string[];

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email?.includes("@")) {
      skipped++;
      continue;
    }
    const role =
      row.role && validRoles.includes(row.role.toLowerCase())
        ? row.role.toLowerCase()
        : "participant";

    let teamId: string | null = null;
    if (row.team?.trim()) {
      const team = await joinOrCreateTeam(row.team);
      teamId = team?.id ?? null;
    }

    const existing = await db.impactLabParticipant.findUnique({ where: { email } });
    if (existing) {
      await db.impactLabParticipant.update({
        where: { id: existing.id },
        data: {
          name: row.name?.trim() || existing.name,
          role,
          teamId: teamId ?? existing.teamId,
        },
      });
      updated++;
    } else {
      await createParticipantWithPoolCode({
        name: row.name?.trim() || email.split("@")[0],
        email,
        role,
        teamId,
        preRegistered: true,
      });
      created++;
    }
  }
  return { created, updated, skipped };
}
