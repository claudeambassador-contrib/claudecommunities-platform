import { and, eq, sql } from "drizzle-orm";
import {
  AUTOMATION_LIVE_STATUSES,
  AUTOMATION_TRIGGERS,
  type AutomationCreateBody,
  type AutomationDetail,
  type AutomationLiveStatus,
  type AutomationStatus,
  type AutomationTrigger,
  EMAIL_SETTINGS_DEFAULTS,
  type EmailAnalytics,
  type EmailSettingsDetail,
  type EmailSettingsInput,
} from "@/modules/email/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function isTriggerType(value: string): value is AutomationTrigger {
  return (AUTOMATION_TRIGGERS as readonly string[]).includes(value);
}

function isLiveStatus(value: string): value is AutomationLiveStatus {
  return (AUTOMATION_LIVE_STATUSES as readonly string[]).includes(value);
}

function toAutomation(row: {
  createdAt: Date;
  id: string;
  name: string;
  status: AutomationStatus;
  triggerType: AutomationTrigger;
  updatedAt: Date;
}): AutomationDetail {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    name: row.name,
    status: row.status,
    triggerType: row.triggerType,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSettings(row: {
  id: string;
  senderEmail: string;
  senderName: string;
  trackClicks: boolean;
  trackOpens: boolean;
}): EmailSettingsDetail {
  return {
    id: row.id,
    senderEmail: row.senderEmail,
    senderName: row.senderName,
    trackClicks: Boolean(row.trackClicks),
    trackOpens: Boolean(row.trackOpens),
  };
}

export async function listAutomations(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ automations: AutomationDetail[] }>> {
  const perm = ensurePermission(actor, "email.view");
  if (!perm.ok) {
    return perm;
  }
  const { emailAutomations } = store.tables;
  const rows = await store.db
    .select()
    .from(emailAutomations)
    .where(eq(emailAutomations.orgId, store.orgId));
  return ok({ automations: rows.map(toAutomation) });
}

export async function createAutomation(
  store: TenantStore,
  actor: Actor,
  input: AutomationCreateBody,
): Promise<Result<{ automation: AutomationDetail }>> {
  const perm = ensurePermission(actor, "email.edit");
  if (!perm.ok) {
    return perm;
  }
  const name = input.name.trim();
  if (!name) {
    return err("bad_request", 400, "name is required");
  }
  if (!isTriggerType(input.triggerType)) {
    return err("bad_request", 400, "triggerType must be signup, event_rsvp, or manual");
  }
  const { emailAutomations } = store.tables;
  const now = new Date();
  const id = newId("ea");
  try {
    await store.db.insert(emailAutomations).values({
      createdAt: now,
      id,
      name,
      orgId: store.orgId,
      status: "draft",
      triggerType: input.triggerType,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "An automation with this name already exists");
    }
    throw error;
  }
  return ok({
    automation: {
      createdAt: now.toISOString(),
      id,
      name,
      status: "draft",
      triggerType: input.triggerType,
      updatedAt: now.toISOString(),
    },
  });
}

export async function setAutomationStatus(
  store: TenantStore,
  actor: Actor,
  id: string,
  status: string,
): Promise<Result<{ automation: AutomationDetail }>> {
  const perm = ensurePermission(actor, "email.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!isLiveStatus(status)) {
    return err("bad_request", 400, "status must be active or paused");
  }
  const { emailAutomations } = store.tables;
  const existing = first(
    await store.db
      .select()
      .from(emailAutomations)
      .where(and(eq(emailAutomations.orgId, store.orgId), eq(emailAutomations.id, id)))
      .limit(1),
  );
  if (!existing) {
    return err("not_found", 404, "Automation not found");
  }
  const now = new Date();
  await store.db
    .update(emailAutomations)
    .set({ status, updatedAt: now })
    .where(and(eq(emailAutomations.orgId, store.orgId), eq(emailAutomations.id, id)));
  return ok({
    automation: toAutomation({ ...existing, status, updatedAt: now }),
  });
}

export async function getEmailSettings(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ settings: EmailSettingsDetail }>> {
  const perm = ensurePermission(actor, "email.settings");
  if (!perm.ok) {
    return perm;
  }
  const { emailSettings } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.orgId, store.orgId))
      .limit(1),
  );
  return ok({ settings: row ? toSettings(row) : { ...EMAIL_SETTINGS_DEFAULTS } });
}

export async function saveEmailSettings(
  store: TenantStore,
  actor: Actor,
  input: EmailSettingsInput,
): Promise<Result<{ settings: EmailSettingsDetail }>> {
  const perm = ensurePermission(actor, "email.settings");
  if (!perm.ok) {
    return perm;
  }
  if (input.trackOpens !== undefined && typeof input.trackOpens !== "boolean") {
    return err("bad_request", 400, "trackOpens must be a boolean");
  }
  if (input.trackClicks !== undefined && typeof input.trackClicks !== "boolean") {
    return err("bad_request", 400, "trackClicks must be a boolean");
  }
  const { emailSettings } = store.tables;
  const existing = first(
    await store.db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.orgId, store.orgId))
      .limit(1),
  );
  const current = existing ? toSettings(existing) : { ...EMAIL_SETTINGS_DEFAULTS };
  const senderName =
    input.senderName === undefined ? current.senderName : (input.senderName ?? "").trim();
  const senderEmail =
    input.senderEmail === undefined ? current.senderEmail : (input.senderEmail ?? "").trim();
  if (senderEmail && !EMAIL_RE.test(senderEmail)) {
    return err("bad_request", 400, "senderEmail must look like an email");
  }
  const trackOpens = input.trackOpens ?? current.trackOpens;
  const trackClicks = input.trackClicks ?? current.trackClicks;
  const now = new Date();
  const next = { senderEmail, senderName, trackClicks, trackOpens };
  if (existing) {
    await store.db
      .update(emailSettings)
      .set({ ...next, updatedAt: now })
      .where(eq(emailSettings.orgId, store.orgId));
    return ok({ settings: { id: existing.id, ...next } });
  }
  const id = newId("es");
  try {
    await store.db.insert(emailSettings).values({
      id,
      orgId: store.orgId,
      ...next,
      updatedAt: now,
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) {
      throw error;
    }
    const raced = first(
      await store.db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.orgId, store.orgId))
        .limit(1),
    );
    if (!raced) {
      throw error;
    }
    await store.db
      .update(emailSettings)
      .set({ ...next, updatedAt: now })
      .where(eq(emailSettings.orgId, store.orgId));
    return ok({ settings: { id: raced.id, ...next } });
  }
  return ok({ settings: { id, ...next } });
}

export async function getEmailAnalytics(
  store: TenantStore,
  actor: Actor,
): Promise<Result<EmailAnalytics>> {
  const perm = ensurePermission(actor, "email.view");
  if (!perm.ok) {
    return perm;
  }
  const { emailSends } = store.tables;
  const totalRow = first(
    await store.db
      .select({ n: sql<number>`count(*)` })
      .from(emailSends)
      .where(eq(emailSends.orgId, store.orgId)),
  );
  const queuedRow = first(
    await store.db
      .select({ n: sql<number>`count(*)` })
      .from(emailSends)
      .where(and(eq(emailSends.orgId, store.orgId), eq(emailSends.status, "queued"))),
  );
  const grouped = await store.db
    .select({
      campaignId: emailSends.campaignId,
      sent: sql<number>`count(*)`,
    })
    .from(emailSends)
    .where(eq(emailSends.orgId, store.orgId))
    .groupBy(emailSends.campaignId);
  return ok({
    byCampaign: grouped.map((row) => ({
      campaignId: row.campaignId,
      sent: Number(row.sent ?? 0),
    })),
    queued: Number(queuedRow?.n ?? 0),
    totalSends: Number(totalRow?.n ?? 0),
  });
}
