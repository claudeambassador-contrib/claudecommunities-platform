/**
 * Slide-export workflow orchestrator.
 *
 * Wraps the DB and SLIDE_EXPORT workflow-binding access for the
 * `/api/admin/slide-export` routes (which can't import prisma / the
 * workflow binding directly — the ESLint import lockdown sends route
 * handlers through this service layer).
 *
 * Three entry points:
 *  - {@link tryShortCircuitCachedExport} — single-pair cache lookup; returns
 *    the cached PNG output synchronously when possible.
 *  - {@link startSlideExportJob} — creates the `SlideExportJob` row and
 *    triggers the workflow. Returns the new jobId.
 *  - {@link getSlideExportJobStatus} — reads the job row, optionally
 *    consults the workflow instance to detect terminal state, and returns
 *    a polling-friendly summary.
 *
 * Auth: callers must enforce admin / owner gating before invoking. The
 * service does ownership filtering on reads but not initial auth.
 */
import { getEnv } from "@/lib/cf-env";
import { getPrisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { getTenantId } from "@/lib/tenant-context";
import type { SlideExportParams } from "@/workflows/slide-export";
import { ServiceError } from "./_errors";
import { DEFAULT_RENDER_REF_WIDTH, getCachedRenderIfFresh } from "./slideRender";
import { getSpeakerInternal } from "./speakers";

/** Hard cap on a single workflow run. Keeps one render step inside the
 *  per-step CPU + browser-session lifetime budget. If the deck genuinely
 *  needs more than this in one go, chunk the workflow into multiple steps
 *  (each step opens its own session). */
const MAX_PAIRS_PER_JOB = 200;

function safeName(s: string): string {
  return s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
}

function clampRefWidth(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_RENDER_REF_WIDTH;
  return Math.max(320, Math.min(2000, Math.round(raw)));
}

export interface StartExportInput {
  eventId: string;
  slideIds: string[];
  speakerIds: string[];
  filenameBase: string;
  refWidth?: number;
  force?: boolean;
  /** True if the editor has more than one slide type so even single-pair
   *  exports should include the slide label in the filename. Prevents
   *  same-speaker filename collisions across separate "Export X's slide"
   *  clicks on different slide types. */
  disambiguateFilenames?: boolean;
}

export interface ShortCircuitResult {
  kind: "png";
  url: string;
  filename: string;
  contentHash: string;
}

/**
 * If `input` resolves to a single (slide, speaker) pair AND the content-hash
 * cache holds it AND force is false, return the cached PNG. Otherwise null
 * to signal that the caller should start a workflow.
 *
 * The filename here MUST match what the workflow's `resolve` step would
 * produce for the same single-pair input — otherwise the same click yields
 * different filenames on cold vs. warm cache, which is jarring.
 */
export async function tryShortCircuitCachedExport(
  input: StartExportInput,
): Promise<ShortCircuitResult | null> {
  if (input.force) return null;
  if (input.slideIds.length !== 1 || input.speakerIds.length !== 1) return null;

  const refWidth = clampRefWidth(input.refWidth);
  const cached = await getCachedRenderIfFresh({
    eventId: input.eventId,
    slideId: input.slideIds[0],
    speakerId: input.speakerIds[0],
    refWidth,
  });
  if (!cached) return null;

  // Match the workflow's filename shape: when the editor has multiple slide
  // types we always include both speaker name and slide label so per-slide
  // exports don't collide on disk; otherwise just the speaker name.
  const base = safeName(input.filenameBase) || "slides";
  let filename = `${base}.png`;
  try {
    const speaker = await getSpeakerInternal(input.speakerIds[0]);
    if (speaker && speaker.eventId === input.eventId) {
      const nameSlug = safeName(speaker.name);
      filename = input.disambiguateFilenames
        ? `${base}_${nameSlug}_${safeName(input.slideIds[0])}.png`
        : `${base}_${nameSlug}.png`;
    }
  } catch {
    // Fall through with the simpler filename — the short-circuit is an
    // optimisation, not the critical path.
  }
  return {
    kind: "png",
    url: cached.url,
    filename,
    contentHash: cached.contentHash,
  };
}

export interface StartExportResult {
  jobId: string;
}

/**
 * Create the SlideExportJob row and trigger the workflow. The PK is the
 * workflow instance id so the status route can recover the workflow handle.
 */
export async function startSlideExportJob(
  input: StartExportInput,
  user: { id: string },
): Promise<StartExportResult> {
  const totalPairs = input.slideIds.length * input.speakerIds.length;
  if (totalPairs > MAX_PAIRS_PER_JOB) {
    throw new ServiceError(
      "bad_request",
      `Too many slides for a single export job (${totalPairs} > ${MAX_PAIRS_PER_JOB}). ` +
        `Split the batch into smaller exports.`,
    );
  }

  const env = getEnv() as unknown as { SLIDE_EXPORT?: Workflow<SlideExportParams> };
  if (!env.SLIDE_EXPORT) {
    throw new ServiceError(
      "unavailable",
      "SLIDE_EXPORT workflow binding is not configured on this environment",
    );
  }

  // Request context — the middleware-stamped tenant. Bake it into the workflow
  // payload so run() (which has no request scope) can re-establish it via
  // runWithTenant; the SlideExportJob row is tenant-scoped via getPrisma().
  const tenantId = await getTenantId();
  const db = await getPrisma();

  const jobId = crypto.randomUUID();
  const params: SlideExportParams = {
    jobId,
    tenantId,
    eventId: input.eventId,
    userId: user.id,
    slideIds: input.slideIds,
    speakerIds: input.speakerIds,
    refWidth: clampRefWidth(input.refWidth),
    force: input.force === true,
    filenameBase: safeName(input.filenameBase) || "slides",
    disambiguateFilenames: input.disambiguateFilenames === true,
  };

  // Create the DB row BEFORE kicking off the workflow so the status route
  // returns a sensible "queued" state right away. If the workflow.create
  // call then fails we flip the row to errored so it doesn't sit queued
  // forever.
  await db.slideExportJob.create({
    data: {
      id: jobId,
      eventId: input.eventId,
      userId: user.id,
      status: "queued",
      params: JSON.stringify(params),
      totalCount: input.slideIds.length * input.speakerIds.length,
      completedCount: 0,
    },
  });

  try {
    await env.SLIDE_EXPORT.create({ id: jobId, params });
  } catch (err) {
    await db.slideExportJob
      .update({
        where: { id: jobId },
        data: {
          status: "errored",
          errorMessage:
            err instanceof Error ? err.message.slice(0, 1000) : "Workflow create failed",
        },
      })
      .catch(() => {});
    throw err;
  }

  return { jobId };
}

export interface SlideExportJobStatus {
  jobId: string;
  status: "queued" | "running" | "complete" | "errored";
  totalCount: number;
  completedCount: number;
  outputKind?: "png" | "zip";
  outputUrl?: string;
  downloadFilename?: string;
  errorMessage?: string;
}

/** Beyond this gap of inactivity on a non-terminal row, ask the workflow itself. */
const STALE_MS = 30_000;

/**
 * Read a SlideExportJob's current state. If the row still says
 * queued/running but hasn't been touched in {@link STALE_MS}, falls back to
 * polling the workflow instance to catch the case where the workflow died
 * before its catch-block could persist the failure.
 *
 * Throws ServiceError("not_found") when the job doesn't exist and
 * ServiceError("forbidden") when the caller isn't the job owner (callers
 * with the `tools.use` permission can read any job).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the status/permission/branching logic would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
export async function getSlideExportJobStatus(
  jobId: string,
  user: { id: string; permissions?: readonly import("@/lib/permissions").Permission[] },
): Promise<SlideExportJobStatus> {
  const db = await getPrisma();
  const row = await db.slideExportJob.findUnique({ where: { id: jobId } });
  if (!row) throw new ServiceError("not_found", "Job not found");
  const canOverride = user.permissions?.includes("tools.use") ?? false;
  if (row.userId !== user.id && !canOverride) {
    throw new ServiceError("forbidden", "Not allowed to read this export job");
  }

  let status = row.status as SlideExportJobStatus["status"];
  let errorMessage = row.errorMessage ?? undefined;
  const completedCount = row.completedCount;
  const totalCount = row.totalCount;
  const outputKind = (row.outputKind ?? undefined) as SlideExportJobStatus["outputKind"];
  const outputR2Key = row.outputR2Key;

  const nonTerminal = status === "queued" || status === "running";
  const stale = Date.now() - row.updatedAt.getTime() > STALE_MS;
  if (nonTerminal && stale) {
    try {
      const env = getEnv() as unknown as {
        SLIDE_EXPORT?: Workflow<SlideExportParams>;
      };
      if (env.SLIDE_EXPORT) {
        const instance = await env.SLIDE_EXPORT.get(jobId);
        const wfStatus = await instance.status();
        // Anything that isn't an in-progress status is terminal. If the row
        // still says queued/running but the workflow is no longer making
        // progress, the run died without persisting back (platform-induced
        // cancellation, "unknown", or a new status string we don't recognise).
        // The dashboard's "Canceled" label is one such case — it doesn't
        // match the typed enum value but still ends the run.
        const inProgress =
          wfStatus.status === "queued" ||
          wfStatus.status === "running" ||
          wfStatus.status === "paused" ||
          wfStatus.status === "waiting" ||
          wfStatus.status === "waitingForPause";
        if (!inProgress) {
          status = "errored";
          errorMessage =
            wfStatus.error?.message ??
            `Workflow ended without writing back (status=${wfStatus.status})`;
          await db.slideExportJob
            .update({
              where: { id: jobId },
              data: { status, errorMessage: errorMessage?.slice(0, 1000) ?? null },
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.warn("[slide-export] workflow status probe failed:", err);
      // Fall through — return DB state as-is.
    }
  }

  let outputUrl: string | undefined;
  let downloadFilename: string | undefined;
  if (status === "complete" && outputR2Key) {
    outputUrl = publicUrl(outputR2Key);
    try {
      const params = JSON.parse(row.params) as SlideExportParams;
      downloadFilename =
        outputKind === "zip" ? `${params.filenameBase}_all.zip` : `${params.filenameBase}.png`;
    } catch {
      downloadFilename = outputKind === "zip" ? "export.zip" : "export.png";
    }
  }

  return {
    jobId: row.id,
    status,
    totalCount,
    completedCount,
    outputKind,
    outputUrl,
    downloadFilename,
    errorMessage,
  };
}
