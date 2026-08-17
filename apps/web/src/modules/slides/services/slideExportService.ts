// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as slidesRepo from "@/modules/slides/repositories/slidesRepository";
import type {
  ShortCircuitResult,
  SlideExportCacheDeps,
  SlideExportJobListItem,
  SlideExportJobStatus,
  SlideExportStartDeps,
  SlideExportStatusDeps,
  SlideExportWorkflowParams,
  StartExportInput,
} from "@/modules/slides/types";
import type { Actor } from "@/shared/auth/actor";
import { ensureOwnerOrPermission, ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

const MAX_PAIRS_PER_JOB = 200;
const DEFAULT_RENDER_REF_WIDTH = 600;
const STALE_MS = 30_000;
const IN_PROGRESS = new Set(["paused", "queued", "running", "waiting", "waitingForPause"]);

function safeName(value: string): string {
  return value.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
}

function clampRefWidth(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_RENDER_REF_WIDTH;
  }
  return Math.max(320, Math.min(2000, Math.round(raw)));
}

function toPublicStatus(
  job: {
    completedCount: number;
    errorMessage: string | null;
    id: string;
    outputKind: "png" | "zip" | null;
    params: SlideExportWorkflowParams | null;
    resultKey: string | null;
    status: SlideExportJobStatus["status"];
    totalCount: number;
  },
  publicUrl?: (key: string) => string,
): SlideExportJobStatus {
  const status: SlideExportJobStatus = {
    completedCount: job.completedCount,
    jobId: job.id,
    status: job.status,
    totalCount: job.totalCount,
  };
  if (job.errorMessage) {
    status.errorMessage = job.errorMessage;
  }
  if (job.outputKind) {
    status.outputKind = job.outputKind;
  }
  if (job.status === "completed" && job.resultKey) {
    status.outputUrl = publicUrl?.(job.resultKey);
    if (job.params?.filenameBase) {
      const base = job.params.filenameBase;
      status.downloadFilename = job.outputKind === "zip" ? `${base}_all.zip` : `${base}.png`;
    } else {
      status.downloadFilename = job.outputKind === "zip" ? "export.zip" : "export.png";
    }
  }
  return status;
}

export async function listExportJobs(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ jobs: SlideExportJobListItem[] }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  return ok({ jobs: await slidesRepo.listJobs(store) });
}

export async function startSlideExportJob(
  store: TenantStore,
  actor: Actor,
  input: StartExportInput,
  deps: SlideExportStartDeps,
): Promise<Result<{ jobId: string }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  const totalPairs = input.slideIds.length * input.speakerIds.length;
  if (totalPairs > MAX_PAIRS_PER_JOB) {
    return err(
      "bad_request",
      400,
      `Too many slides for a single export job (${totalPairs} > ${MAX_PAIRS_PER_JOB}). Split the batch into smaller exports.`,
    );
  }

  const jobId = crypto.randomUUID();
  const params: SlideExportWorkflowParams = {
    disambiguateFilenames: input.disambiguateFilenames === true,
    eventId: input.eventId,
    filenameBase: safeName(input.filenameBase) || "slides",
    force: input.force === true,
    jobId,
    orgId: store.orgId,
    refWidth: clampRefWidth(input.refWidth),
    slideIds: input.slideIds,
    speakerIds: input.speakerIds,
    totalPairs,
    userId: actor.id,
  };

  const inserted = await slidesRepo.insertJob(store, {
    eventId: input.eventId,
    id: jobId,
    paramsJson: JSON.stringify(params),
    totalCount: totalPairs,
    userId: actor.id,
  });
  if (!inserted.ok) {
    return inserted;
  }

  try {
    await deps.workflow.create(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow create failed";
    await slidesRepo.markJobFailed(store, jobId, message);
    return err("unavailable", 503, message);
  }
  return inserted;
}

export async function getSlideExportJobStatus(
  store: TenantStore,
  actor: Actor,
  jobId: string,
  deps: SlideExportStatusDeps = {},
): Promise<Result<{ job: SlideExportJobStatus }>> {
  const found = await slidesRepo.getJobById(store, jobId);
  if (!found.ok) {
    return found;
  }
  const allowed = ensureOwnerOrPermission(actor, found.job.userId ?? "", "tools.use");
  if (!allowed.ok) {
    return allowed;
  }

  let { job } = found;
  const updatedAtMs = Date.parse(job.updatedAt);
  const nowMs = (deps.now ?? new Date()).getTime();
  const stale = Number.isFinite(updatedAtMs) && nowMs - updatedAtMs > STALE_MS;
  const nonTerminal = job.status === "queued" || job.status === "running";
  if (nonTerminal && stale && deps.workflow?.getInstanceStatus) {
    try {
      const instance = await deps.workflow.getInstanceStatus(jobId);
      if (instance && !IN_PROGRESS.has(instance.status)) {
        const errorMessage =
          instance.errorMessage ??
          `Workflow ended without writing back (status=${instance.status})`;
        await slidesRepo.markJobFailed(store, jobId, errorMessage);
        const refreshed = await slidesRepo.getJobById(store, jobId);
        if (refreshed.ok) {
          ({ job } = refreshed);
        }
      }
    } catch {
      // Keep the persisted row when the workflow probe fails.
    }
  }

  return ok({ job: toPublicStatus(job, deps.storage?.publicUrl) });
}

export async function tryShortCircuitCachedExport(
  _store: TenantStore,
  actor: Actor,
  input: StartExportInput,
  deps: SlideExportCacheDeps,
): Promise<Result<{ cached: ShortCircuitResult | null }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  if (input.force || input.slideIds.length !== 1 || input.speakerIds.length !== 1) {
    return ok({ cached: null });
  }
  const [slideId] = input.slideIds;
  const [speakerId] = input.speakerIds;
  if (!(slideId && speakerId)) {
    return ok({ cached: null });
  }

  const refWidth = clampRefWidth(input.refWidth);
  let cached: { contentHash: string; url: string } | null;
  try {
    cached = await deps.cache.getFresh({
      eventId: input.eventId,
      refWidth,
      slideId,
      speakerId,
    });
  } catch {
    return ok({ cached: null });
  }
  if (!cached) {
    return ok({ cached: null });
  }

  const base = safeName(input.filenameBase) || "slides";
  let filename = `${base}.png`;
  try {
    const speakerName = await deps.resolveSpeakerName?.(speakerId, input.eventId);
    if (speakerName) {
      const nameSlug = safeName(speakerName);
      filename = input.disambiguateFilenames
        ? `${base}_${nameSlug}_${safeName(slideId)}.png`
        : `${base}_${nameSlug}.png`;
    }
  } catch {
    // Keep the simpler filename — short-circuit is an optimisation.
  }
  return ok({
    cached: {
      contentHash: cached.contentHash,
      filename,
      kind: "png",
      url: cached.url,
    },
  });
}
