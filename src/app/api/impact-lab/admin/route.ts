import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { withService } from "@/lib/services/_route";
import {
  adminBulkImportParticipants,
  adminCreateParticipant,
  adminCreateResource,
  adminCreateScheduleItem,
  adminCreateStatement,
  adminCreateTeam,
  adminDeleteParticipant,
  adminDeleteResource,
  adminDeleteScheduleItem,
  adminDeleteStatement,
  adminDeleteTeam,
  adminUpdateParticipant,
  adminUpdateResource,
  adminUpdateScheduleItem,
  adminUpdateSettings,
  adminUpdateStatement,
  adminUpdateTeam,
  COFFEE_POOL_SIZE,
  PARTICIPANT_ROLES,
  regenerateCoffeePool,
  requirePortalAdmin,
  resetCoffeePool,
} from "@/lib/services/impactLab";

const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// ─── Teams ──────────────────────────────────────────────────────────
const TeamInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().max(20).optional(),
  tableNumber: z.string().trim().max(20).nullable().optional(),
});

async function handleTeam(action: string, body: unknown) {
  const parsed = TeamInput.safeParse(body);
  if (!parsed.success) return bad("Invalid team data");
  const d = parsed.data;

  if (action === "create") {
    const team = await adminCreateTeam(d);
    return ok({ team });
  }
  if (action === "update") {
    if (!d.id) return bad("Missing team id");
    const team = await adminUpdateTeam(d.id, d);
    return ok({ team });
  }
  if (action === "delete") {
    if (!d.id) return bad("Missing team id");
    await adminDeleteTeam(d.id);
    return ok();
  }
  return bad("Unknown action");
}

// ─── Participants ───────────────────────────────────────────────────
const ParticipantInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  role: z.enum(PARTICIPANT_ROLES).optional(),
  teamId: z.string().nullable().optional(),
});

async function handleParticipant(action: string, body: unknown) {
  const parsed = ParticipantInput.safeParse(body);
  if (!parsed.success) return bad("Invalid participant data");
  const d = parsed.data;

  if (action === "create") {
    const participant = await adminCreateParticipant(d);
    return ok({ participant });
  }
  if (action === "update") {
    if (!d.id) return bad("Missing participant id");
    const participant = await adminUpdateParticipant(d.id, d);
    return ok({ participant });
  }
  if (action === "delete") {
    if (!d.id) return bad("Missing participant id");
    await adminDeleteParticipant(d.id);
    return ok();
  }
  return bad("Unknown action");
}

// ─── Problem statements ─────────────────────────────────────────────
const StatementInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().min(1).max(280).optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  order: z.number().int().min(0).max(999).optional(),
});

async function handleStatement(action: string, body: unknown) {
  const parsed = StatementInput.safeParse(body);
  if (!parsed.success) return bad("Invalid problem statement data");
  const d = parsed.data;

  if (action === "create") {
    const statement = await adminCreateStatement(d);
    return ok({ statement });
  }
  if (action === "update") {
    if (!d.id) return bad("Missing statement id");
    const statement = await adminUpdateStatement(d.id, d);
    return ok({ statement });
  }
  if (action === "delete") {
    if (!d.id) return bad("Missing statement id");
    await adminDeleteStatement(d.id);
    return ok();
  }
  return bad("Unknown action");
}

// ─── Schedule ───────────────────────────────────────────────────────
const ScheduleInput = z.object({
  id: z.string().optional(),
  startTime: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(600).nullable().optional(),
  track: z.string().trim().max(60).nullable().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

async function handleSchedule(action: string, body: unknown) {
  const parsed = ScheduleInput.safeParse(body);
  if (!parsed.success) return bad("Invalid schedule data");
  const d = parsed.data;

  if (action === "create") {
    const item = await adminCreateScheduleItem(d);
    return ok({ item });
  }
  if (action === "update") {
    if (!d.id) return bad("Missing schedule item id");
    const item = await adminUpdateScheduleItem(d.id, d);
    return ok({ item });
  }
  if (action === "delete") {
    if (!d.id) return bad("Missing schedule item id");
    await adminDeleteScheduleItem(d.id);
    return ok();
  }
  return bad("Unknown action");
}

// ─── Resources ──────────────────────────────────────────────────────
const ResourceInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(600).nullable().optional(),
  url: z.string().trim().url().max(600).optional(),
  category: z.string().trim().max(60).optional(),
  order: z.number().int().min(0).max(999).optional(),
});

async function handleResource(action: string, body: unknown) {
  const parsed = ResourceInput.safeParse(body);
  if (!parsed.success) return bad("Invalid resource data");
  const d = parsed.data;

  if (action === "create") {
    const item = await adminCreateResource(d);
    return ok({ item });
  }
  if (action === "update") {
    if (!d.id) return bad("Missing resource id");
    const item = await adminUpdateResource(d.id, d);
    return ok({ item });
  }
  if (action === "delete") {
    if (!d.id) return bad("Missing resource id");
    await adminDeleteResource(d.id);
    return ok();
  }
  return bad("Unknown action");
}

// ─── Coffee code pool ───────────────────────────────────────────────
const CoffeeInput = z.object({
  target: z.number().int().min(1).max(1000).optional(),
});

async function handleCoffee(action: string, body: unknown) {
  const parsed = CoffeeInput.safeParse(body);
  if (!parsed.success) return bad("Invalid coffee data");
  const target = parsed.data.target ?? COFFEE_POOL_SIZE;

  if (action === "regenerate") {
    const result = await regenerateCoffeePool(target);
    return ok(result);
  }
  if (action === "reset") {
    const total = await resetCoffeePool(target);
    return ok({ total });
  }
  return bad("Unknown action");
}

// ─── Settings ───────────────────────────────────────────────────────
const SettingsInput = z.object({
  eventName: z.string().trim().min(1).max(120).optional(),
  eventTagline: z.string().trim().min(1).max(200).optional(),
  eventDate: z.string().trim().min(1).max(60).optional(),
  accessCode: z.string().trim().min(3).max(64).optional(),
  adminPassword: z.string().trim().min(4).max(200).optional(),
  coffeeNote: z.string().trim().min(1).max(400).optional(),
  checkInOpen: z.boolean().optional(),
  votingOpen: z.boolean().optional(),
  peoplesChoiceOpen: z.boolean().optional(),
  peoplesChoiceWinnerTeamId: z.string().nullable().optional(),
  winningStatementId: z.string().nullable().optional(),
});

async function handleSettings(body: unknown) {
  const parsed = SettingsInput.safeParse(body);
  if (!parsed.success) return bad("Invalid settings");
  const config = await adminUpdateSettings(parsed.data);
  return ok({ config });
}

// ─── Bulk participant import ────────────────────────────────────────
const ImportInput = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().max(120).optional(),
        email: z.string().trim().max(200),
        role: z.string().trim().max(40).optional(),
        team: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .max(2000),
});

async function handleImport(body: unknown) {
  const parsed = ImportInput.safeParse(body);
  if (!parsed.success) return bad("Invalid import data");
  const result = await adminBulkImportParticipants(parsed.data.rows);
  return ok(result);
}

export const POST = withService(async (request) => {
  const limited = rateLimit(request, { limit: 120, windowMs: 60_000, key: "impactlab:admin" });
  if (limited) return limited;

  await requirePortalAdmin();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid request");
  }

  const resource = typeof body.resource === "string" ? body.resource : "";
  const action = typeof body.action === "string" ? body.action : "";

  switch (resource) {
    case "team":
      return handleTeam(action, body);
    case "participant":
      return handleParticipant(action, body);
    case "statement":
      return handleStatement(action, body);
    case "schedule":
      return handleSchedule(action, body);
    case "resource":
      return handleResource(action, body);
    case "settings":
      return handleSettings(body);
    case "coffee":
      return handleCoffee(action, body);
    case "import":
      return handleImport(body);
    default:
      return bad("Unknown resource");
  }
});
