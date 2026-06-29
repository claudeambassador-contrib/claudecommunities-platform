/**
 * Durable batch slide export.
 *
 * Renders each (slide, speaker) pair as its own `step.do` so a
 * platform-side `WorkflowInternalError` on one pair doesn't restart the
 * rest of the batch, and the DB row ticks `completedCount` forward
 * per-pair for the polling UI. Result is either a single PNG (1 pair) or a
 * zipped bundle (N pairs) persisted to R2 under
 * `slides/export/<jobId>{.png,.zip}`.
 *
 * Why a workflow and not just a long-lived fetch handler:
 *  - Workers' subrequest / CPU budget is tight; a 200-pair batch would
 *    blow it. Each per-pair step gets its own budget and can be retried
 *    independently if a flake kills a render.
 *  - Cloudflare Browser Rendering caps at 10 concurrent sessions per
 *    account. Steps execute serially, so we open one session at a time
 *    and stay well under the cap.
 *  - The client polls `/api/admin/slide-export/[jobId]` for progress; each
 *    per-pair step bumps `SlideExportJob.completedCount` so the UI sees
 *    forward movement even on slow renders.
 *
 * Failure handling: any uncaught error in `run()` is caught, persisted to
 * `SlideExportJob.errorMessage`, and re-thrown so the workflow instance
 * terminates in `errored`. The status route reads the DB row first and only
 * consults the workflow instance for terminal-state fallback.
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import JSZip from "jszip";
import type { SlideEntry } from "@/components/slide-generator/persistence";
import { runWithEnv } from "@/lib/cf-env";
import { getPrisma } from "@/lib/prisma";
import { getStateInternal } from "@/lib/services/slideGenerator";
import { type RenderPair, renderPairForExport } from "@/lib/services/slideRender";
import { getSpeakerInternal } from "@/lib/services/speakers";
import { getObject, publicUrl, putBytesAtKey } from "@/lib/storage";
import { runWithTenant } from "@/lib/tenant-context";

export interface SlideExportParams {
  /** Matches the workflow instance id and the `SlideExportJob.id` PK. */
  jobId: string;
  /** Tenant that owns this job. Captured from the request at dispatch and
   *  re-established via runWithTenant in run() — workflows have no request
   *  scope, so the scoped Prisma client would otherwise throw fail-closed. */
  tenantId: string;
  eventId: string;
  userId: string;
  /** Cartesian product of `slideIds × speakerIds` defines the render targets. */
  slideIds: string[];
  speakerIds: string[];
  refWidth?: number;
  /** When true, skip the per-pair content-hash cache and re-screenshot every pair. */
  force?: boolean;
  /** Filename prefix used to name the output PNG / ZIP and the entries inside the ZIP. */
  filenameBase: string;
  /** When true, every filename includes both speaker name and slide label
   *  even when only one slide is in this request — useful when the editor
   *  has multiple slide types so separate per-slide exports don't collide. */
  disambiguateFilenames?: boolean;
}

interface ResolvedPair {
  pair: RenderPair;
  filename: string;
}

interface ResolveResult {
  pairs: ResolvedPair[];
  filenameBase: string;
}

interface PackageResult {
  outputKind: "png" | "zip";
  outputR2Key: string;
  downloadFilename: string;
}

function safeName(s: string): string {
  return s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
}

interface StoredStateLike {
  slides?: SlideEntry[];
}

export class SlideExportWorkflow extends WorkflowEntrypoint<CloudflareEnv, SlideExportParams> {
  async run(event: WorkflowEvent<SlideExportParams>, step: WorkflowStep): Promise<PackageResult> {
    const params = event.payload;
    // Each step.do callback may execute in a fresh async context that inherits
    // neither the CloudflareEnv ALS (runWithEnv) NOR the tenant ALS
    // (runWithTenant) from the enclosing run(). We therefore re-enter BOTH
    // inside every callback so prisma/storage/browser calls resolve (a) the
    // CloudflareEnv via the workflow ALS instead of getCloudflareContext()
    // (which throws — workflows don't go through the OpenNext request wrapper)
    // and (b) the tenant from the payload instead of a request header (which
    // doesn't exist off-request — getPrisma() would throw fail-closed).
    const env = this.env;
    const inScope = <T>(fn: () => Promise<T>): Promise<T> =>
      runWithEnv(env, () => runWithTenant(params.tenantId, fn));
    try {
      const resolved = await step.do("resolve", () => inScope(() => this.resolve(params)));

      // Render each pair as its own step.do. Per-pair steps mean a
      // `WorkflowInternalError` on one pair (isolate eviction, transient
      // platform retry) doesn't blow away progress on the others, and the
      // dashboard / DB row tick forward one pair at a time. Trade-off:
      // each step opens its own browser session, so an N-pair batch pays
      // for N session launches instead of 1.
      const rendered: Array<{ pair: RenderPair; r2Key: string }> = [];
      for (let i = 0; i < resolved.pairs.length; i++) {
        const target = resolved.pairs[i];
        const r2Key = await step.do(
          `render-pair-${i}`,
          { retries: { limit: 1, delay: "5 seconds", backoff: "exponential" } },
          () =>
            inScope(async () => {
              const ref = await renderPairForExport({
                pair: target.pair,
                refWidth: params.refWidth,
                force: params.force,
              });
              await (await getPrisma()).slideExportJob.update({
                where: { id: params.jobId },
                data: { completedCount: i + 1 },
              });
              return ref.r2Key;
            }),
        );
        rendered.push({ pair: target.pair, r2Key });
      }

      const output = await step.do("package", () =>
        inScope(() => this.packageOutput(params, resolved, rendered)),
      );

      await step.do("finalize", () =>
        inScope(async () => {
          await (await getPrisma()).slideExportJob.update({
            where: { id: params.jobId },
            data: {
              status: "complete",
              outputKind: output.outputKind,
              outputR2Key: output.outputR2Key,
              completedCount: resolved.pairs.length,
            },
          });
        }),
      );

      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Best-effort error persistence — the status route still has the
      // workflow instance as a fallback if this update is itself the
      // failure point.
      await inScope(async () => {
        await (await getPrisma()).slideExportJob.update({
          where: { id: params.jobId },
          data: { status: "errored", errorMessage: message.slice(0, 1000) },
        });
      }).catch(() => {});
      throw err;
    }
  }

  private async resolve(params: SlideExportParams): Promise<ResolveResult> {
    // Look up slide labels + speaker names so the ZIP entries and the
    // downloaded filename are human-readable rather than opaque IDs.
    const state = await getStateInternal(`event:${params.eventId}`);
    if (!state) throw new Error("No slide state for event");
    const slides = (state.data as StoredStateLike | null)?.slides ?? [];
    const slideById = new Map(slides.map((s) => [s.id, s] as const));

    const speakerNames = new Map<string, string>();
    for (const speakerId of params.speakerIds) {
      const speaker = await getSpeakerInternal(speakerId);
      if (!speaker) throw new Error(`Speaker not found: ${speakerId}`);
      if (speaker.eventId !== params.eventId) {
        throw new Error(`Speaker ${speakerId} does not belong to event ${params.eventId}`);
      }
      speakerNames.set(speakerId, speaker.name);
    }

    const includeSlideLabel = params.slideIds.length > 1 || params.disambiguateFilenames === true;
    const pairs: ResolvedPair[] = [];
    for (const slideId of params.slideIds) {
      const slide = slideById.get(slideId);
      if (!slide) throw new Error(`Slide not found in event state: ${slideId}`);
      for (const speakerId of params.speakerIds) {
        const speakerName = speakerNames.get(speakerId) ?? speakerId;
        const slideLabel = slide.label || slide.template.aspect_ratio;
        const filename = includeSlideLabel
          ? `${params.filenameBase}_${safeName(speakerName)}_${safeName(slideLabel)}.png`
          : `${params.filenameBase}_${safeName(speakerName)}.png`;
        pairs.push({
          pair: { eventId: params.eventId, slideId, speakerId },
          filename,
        });
      }
    }

    await (await getPrisma()).slideExportJob.update({
      where: { id: params.jobId },
      data: {
        status: "running",
        totalCount: pairs.length,
        completedCount: 0,
      },
    });

    return { pairs, filenameBase: params.filenameBase };
  }

  private async packageOutput(
    params: SlideExportParams,
    resolved: ResolveResult,
    rendered: Array<{ pair: RenderPair; r2Key: string }>,
  ): Promise<PackageResult> {
    if (rendered.length === 0) {
      throw new Error("Nothing to package — empty render result");
    }

    // Single-pair: skip zipping; the rendered PNG IS the deliverable.
    if (rendered.length === 1) {
      return {
        outputKind: "png",
        outputR2Key: rendered[0].r2Key,
        downloadFilename: resolved.pairs[0].filename,
      };
    }

    // Multi-pair: assemble a ZIP. JSZip works in Workers (pure JS, no node
    // streams). Each entry is stored uncompressed because the inputs are
    // already PNGs (compressed) — re-deflating them adds CPU for ~0% gain.
    const zip = new JSZip();
    const usedNames = new Set<string>();
    // rendered[i] order matches resolved.pairs[i] order (the render loop
    // pushes in resolved-pair order), so this index lookup is correct.
    for (let i = 0; i < rendered.length; i++) {
      const ref = rendered[i];
      const obj = await getObject(ref.r2Key);
      if (!obj) {
        throw new Error(`R2 object missing for rendered pair: ${ref.r2Key}`);
      }
      const bytes = new Uint8Array(await obj.arrayBuffer());
      let name = resolved.pairs[i].filename;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf(".");
        const stem = dot >= 0 ? name.slice(0, dot) : name;
        const ext = dot >= 0 ? name.slice(dot) : "";
        let n = 2;
        while (usedNames.has(`${stem}_${n}${ext}`)) n++;
        name = `${stem}_${n}${ext}`;
      }
      usedNames.add(name);
      zip.file(name, bytes, { compression: "STORE" });
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const zipKey = `slides/export/${params.jobId}.zip`;
    await putBytesAtKey(zipKey, zipBytes, "application/zip");
    return {
      outputKind: "zip",
      outputR2Key: zipKey,
      downloadFilename: `${params.filenameBase}_all.zip`,
    };
  }
}

/**
 * Build the public URL the client should hit to download the deliverable.
 * Returns the same `/api/files/<key>` shape the rest of the storage layer
 * produces.
 */
export function exportOutputUrl(r2Key: string): string {
  return publicUrl(r2Key);
}
