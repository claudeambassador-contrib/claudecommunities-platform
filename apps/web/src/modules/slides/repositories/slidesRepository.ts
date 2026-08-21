import { and, desc, eq } from "drizzle-orm";

import type {
  SlideExportJobDetail,
  SlideExportJobListItem,
  SlideExportJobStatusValue,
  SlideExportJobWrite,
  SlideExportWorkflowParams,
  SlideGeneratorState,
  SlideStatePutResult,
  SlideStateWrite,
  SlideStylePresetCreated,
  SlideStylePresetDetail,
} from "@/modules/slides/types";
import { first } from "@/shared/db/rows";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type SlidesTables = Pick<
  TenantTables,
  "slideExportJobs" | "slideGeneratorStates" | "slideStylePresets"
>;
const tables = (store: TenantStore): SlidesTables => store.tables;

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseParams(raw: string): SlideExportWorkflowParams | null {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return parsed as SlideExportWorkflowParams;
}

function asJobStatus(value: string): SlideExportJobStatusValue {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return "failed";
}

function asOutputKind(value: string | null): "png" | "zip" | null {
  if (value === "png" || value === "zip") {
    return value;
  }
  return null;
}

function toJobDetail(row: {
  completedCount: number;
  errorMessage: string | null;
  eventId: string | null;
  id: string;
  outputKind: string | null;
  paramsJson: string;
  resultKey: string | null;
  status: string;
  totalCount: number;
  updatedAt: Date;
  userId: string | null;
}): SlideExportJobDetail {
  return {
    completedCount: row.completedCount,
    errorMessage: row.errorMessage,
    eventId: row.eventId,
    id: row.id,
    outputKind: asOutputKind(row.outputKind),
    params: parseParams(row.paramsJson),
    resultKey: row.resultKey,
    status: asJobStatus(row.status),
    totalCount: row.totalCount,
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
  };
}

export async function getStateByScope(
  store: TenantStore,
  scope: string,
): Promise<SlideGeneratorState> {
  const { slideGeneratorStates } = tables(store);
  const rows = await store.db
    .select()
    .from(slideGeneratorStates)
    .where(and(eq(slideGeneratorStates.orgId, store.orgId), eq(slideGeneratorStates.scope, scope)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return { data: null, scope, updatedAt: null };
  }
  return {
    data: parseJson(row.stateJson),
    scope: row.scope,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertState(
  store: TenantStore,
  write: SlideStateWrite,
): Promise<Result<SlideStatePutResult>> {
  const { slideGeneratorStates } = tables(store);
  const now = new Date();
  const existing = first(
    await store.db
      .select()
      .from(slideGeneratorStates)
      .where(
        and(
          eq(slideGeneratorStates.orgId, store.orgId),
          eq(slideGeneratorStates.scope, write.scope),
        ),
      )
      .limit(1),
  );
  if (existing) {
    await store.db
      .update(slideGeneratorStates)
      .set({ eventId: write.eventId, stateJson: write.dataJson, updatedAt: now })
      .where(
        and(eq(slideGeneratorStates.orgId, store.orgId), eq(slideGeneratorStates.id, existing.id)),
      );
    return ok({ scope: write.scope, updatedAt: now.toISOString() });
  }
  try {
    await store.db.insert(slideGeneratorStates).values({
      createdAt: now,
      eventId: write.eventId,
      id: newId("sgs"),
      orgId: store.orgId,
      scope: write.scope,
      stateJson: write.dataJson,
      updatedAt: now,
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) {
      throw error;
    }
    await store.db
      .update(slideGeneratorStates)
      .set({ eventId: write.eventId, stateJson: write.dataJson, updatedAt: now })
      .where(
        and(
          eq(slideGeneratorStates.orgId, store.orgId),
          eq(slideGeneratorStates.scope, write.scope),
        ),
      );
  }
  return ok({ scope: write.scope, updatedAt: now.toISOString() });
}

export async function listPresets(store: TenantStore): Promise<SlideStylePresetDetail[]> {
  const { slideStylePresets } = tables(store);
  const rows = await store.db
    .select()
    .from(slideStylePresets)
    .where(eq(slideStylePresets.orgId, store.orgId))
    .orderBy(desc(slideStylePresets.updatedAt));
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    data: parseJson(row.dataJson),
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getPresetById(
  store: TenantStore,
  id: string,
): Promise<Result<{ preset: SlideStylePresetDetail }>> {
  const { slideStylePresets } = tables(store);
  const rows = await store.db
    .select()
    .from(slideStylePresets)
    .where(and(eq(slideStylePresets.orgId, store.orgId), eq(slideStylePresets.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Preset not found");
  }
  return ok({
    preset: {
      createdAt: row.createdAt.toISOString(),
      data: parseJson(row.dataJson),
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}

export async function insertPreset(
  store: TenantStore,
  name: string,
  dataJson: string,
): Promise<Result<{ preset: SlideStylePresetCreated }>> {
  const { slideStylePresets } = tables(store);
  const now = new Date();
  const id = newId("prst");
  try {
    await store.db.insert(slideStylePresets).values({
      createdAt: now,
      dataJson,
      id,
      name,
      orgId: store.orgId,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, `A preset named "${name}" already exists`);
    }
    throw error;
  }
  return ok({ preset: { id, name } });
}

export async function updatePresetById(
  store: TenantStore,
  id: string,
  name: string | undefined,
  dataJson: string | undefined,
): Promise<Result<{ preset: SlideStylePresetCreated }>> {
  const existing = await getPresetById(store, id);
  if (!existing.ok) {
    return existing;
  }
  if (name === undefined && dataJson === undefined) {
    return ok({ preset: { id, name: existing.preset.name } });
  }
  const set: { dataJson?: string; name?: string; updatedAt: Date } = { updatedAt: new Date() };
  if (name !== undefined) {
    set.name = name;
  }
  if (dataJson !== undefined) {
    set.dataJson = dataJson;
  }
  const { slideStylePresets } = tables(store);
  try {
    await store.db
      .update(slideStylePresets)
      .set(set)
      .where(and(eq(slideStylePresets.orgId, store.orgId), eq(slideStylePresets.id, id)));
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, `A preset named "${name}" already exists`);
    }
    throw error;
  }
  return ok({ preset: { id, name: name ?? existing.preset.name } });
}

export async function deletePresetById(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getPresetById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { slideStylePresets } = tables(store);
  await store.db
    .delete(slideStylePresets)
    .where(and(eq(slideStylePresets.orgId, store.orgId), eq(slideStylePresets.id, id)));
  return ok({ success: true });
}

export async function listJobs(store: TenantStore): Promise<SlideExportJobListItem[]> {
  const { slideExportJobs } = tables(store);
  const rows = await store.db
    .select()
    .from(slideExportJobs)
    .where(eq(slideExportJobs.orgId, store.orgId))
    .orderBy(desc(slideExportJobs.createdAt));
  return rows.map((row) => ({
    id: row.id,
    status: asJobStatus(row.status),
  }));
}

export async function getJobById(
  store: TenantStore,
  id: string,
): Promise<Result<{ job: SlideExportJobDetail }>> {
  const { slideExportJobs } = tables(store);
  const rows = await store.db
    .select()
    .from(slideExportJobs)
    .where(and(eq(slideExportJobs.orgId, store.orgId), eq(slideExportJobs.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Job not found");
  }
  return ok({ job: toJobDetail(row) });
}

export async function insertJob(
  store: TenantStore,
  input: SlideExportJobWrite,
): Promise<Result<{ jobId: string }>> {
  const { slideExportJobs } = tables(store);
  const now = new Date();
  try {
    await store.db.insert(slideExportJobs).values({
      completedCount: 0,
      createdAt: now,
      eventId: input.eventId,
      id: input.id,
      orgId: store.orgId,
      paramsJson: input.paramsJson,
      status: "queued",
      totalCount: input.totalCount,
      updatedAt: now,
      userId: input.userId,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "Export job already exists");
    }
    throw error;
  }
  return ok({ jobId: input.id });
}

export async function markJobFailed(
  store: TenantStore,
  id: string,
  errorMessage: string,
): Promise<void> {
  const { slideExportJobs } = tables(store);
  await store.db
    .update(slideExportJobs)
    .set({
      errorMessage: errorMessage.slice(0, 1000),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(and(eq(slideExportJobs.orgId, store.orgId), eq(slideExportJobs.id, id)));
}
