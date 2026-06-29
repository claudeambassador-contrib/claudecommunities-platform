/**
 * Durable execution for publishing a SocialPost.
 *
 * Why a workflow:
 *  - The publish path makes external calls (LinkedIn or Zernio) that can
 *    take seconds and occasionally hang. With a plain request handler, a
 *    Worker death mid-publish leaves the SocialPost stranded in
 *    "publishing" because the catch block that flips it to "failed" never
 *    runs.
 *  - Each `step.do` is checkpointed by Workflows. If the worker dies
 *    between steps, the runtime re-invokes us at the next step. The atomic
 *    DB claim (status: "draft|scheduled|failed" → "publishing") is the
 *    very first step, so re-entry past that point is safe.
 *  - Built-in retry with backoff for the external publish call covers
 *    transient platform errors without us writing retry plumbing.
 *
 * Instance id convention: `${postId}-${attempt}` — gives natural
 * deduplication per attempt and avoids collisions on retry.
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { runWithEnv } from "@/lib/cf-env";
import { getPrisma } from "@/lib/prisma";
import { getAccountForPublishing } from "@/lib/services/socialAccounts";
import { getProvider } from "@/lib/social/providers/registry";
import type { ConnectorId, SocialMediaType, SocialPlatform } from "@/lib/social/types";
import { getObject } from "@/lib/storage";
import { runWithTenant } from "@/lib/tenant-context";

export interface PublishPostParams {
  postId: string;
  /** Tenant that owns the post. The dispatcher (request or cron per-row)
   *  stamps it; run() re-enters runWithTenant(tenantId) inside every step.do
   *  so the scoped Prisma client resolves off-request (no header → would
   *  otherwise throw fail-closed). SocialPost + SocialAccount are scoped. */
  tenantId: string;
}

const DOCUMENT_MIME = "application/pdf";

function guessMime(url: string, mediaType: SocialMediaType): string {
  if (mediaType === "document") return DOCUMENT_MIME;
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    pdf: DOCUMENT_MIME,
  };
  return (
    map[ext] ??
    (mediaType === "video"
      ? "video/mp4"
      : mediaType === "image" || mediaType === "multi_image"
        ? "image/jpeg"
        : "application/octet-stream")
  );
}

async function readStorageBytes(url: string): Promise<ArrayBuffer> {
  const PREFIX = "/api/files/";
  const idx = url.indexOf(PREFIX);
  if (idx === -1) throw new Error(`Not a storage URL: ${url}`);
  const key = url.slice(idx + PREFIX.length);
  const obj = await getObject(key);
  if (!obj) throw new Error(`Media object missing in R2: ${key}`);
  return obj.arrayBuffer();
}

/**
 * Wrap a step callback so that failed attempts log which step threw and
 * what the error was. Without this, `wrangler tail` shows a generic
 * `PublishPostWorkflow.run - Exception Thrown` with no step name —
 * useless when triaging a retry-and-recover. The workflow runtime still
 * emits its own log line; ours just lands right before it with context.
 */
async function trace<T>(stepName: string, postId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[publish-post-workflow] post=${postId} step=${stepName} threw: ${msg}`);
    throw err;
  }
}

export class PublishPostWorkflow extends WorkflowEntrypoint<CloudflareEnv, PublishPostParams> {
  async run(event: WorkflowEvent<PublishPostParams>, step: WorkflowStep): Promise<void> {
    const { postId } = event.payload;
    const env = this.env;
    // step.do callbacks run in a fresh async context inheriting neither the
    // CloudflareEnv ALS nor the tenant ALS from run() — re-enter both so
    // getPrisma() resolves the DB binding AND the payload tenant (workflows
    // have no request header).
    const inScope = <T>(fn: () => Promise<T>): Promise<T> =>
      runWithEnv(env, () => runWithTenant(event.payload.tenantId, fn));

    try {
      // ── Step 1: verify claim ───────────────────────────────────────
      // publishExisting already performed the atomic CAS that moved the row
      // into "publishing" and incremented publishAttempts. The workflow's
      // job is to verify the claim still holds (row wasn't cancelled or
      // mutated between dispatch and the workflow runtime picking us up)
      // and then run the publish. Don't re-CAS here — the row is already
      // "publishing" so a draft|scheduled|failed → publishing CAS would
      // silently no-op and abort the whole workflow.
      const claimed = await step.do("verify", async () =>
        trace("verify", postId, async () =>
          inScope(async () => {
            const row = await (await getPrisma()).socialPost.findUnique({
              where: { id: postId },
              select: { status: true },
            });
            return row?.status === "publishing";
          }),
        ),
      );
      if (!claimed) {
        // Row was cancelled / mutated out from under us between dispatch
        // and the workflow runtime starting. Nothing for us to do.
        console.warn(
          `[publish-post-workflow] post ${postId} no longer in 'publishing' state, aborting`,
        );
        return;
      }

      // ── Step 2: resolve post + account + media ──────────────────────
      const prepared = await step.do("prepare", async () =>
        trace("prepare", postId, async () =>
          inScope(async () => {
            const post = await (await getPrisma()).socialPost.findUnique({
              where: { id: postId },
              include: { account: true },
            });
            if (!post) throw new Error(`Post not found after claim: ${postId}`);
            const account = await getAccountForPublishing(post.accountId);
            const provider = getProvider(account.connector as ConnectorId);
            const mediaUrls = JSON.parse(post.mediaUrls) as string[];

            // Connectors with their own scheduler (Zernio) get the post handed
            // off immediately with `scheduledFor` set — they fire it at the
            // exact minute. Only delegate when the scheduled time is still in
            // the future; a past/now time means publish straight away.
            const scheduledForIso =
              provider.supportsNativeScheduling &&
              post.scheduledAt &&
              post.scheduledAt.getTime() > Date.now()
                ? post.scheduledAt.toISOString()
                : null;

            // OAuth connectors (LinkedIn direct) upload bytes themselves;
            // API-key connectors (Zernio) hand off a public URL. Skip the
            // R2 reads when the bytes aren't needed.
            const needsBytes = provider.connectKind === "oauth";
            const media = await Promise.all(
              mediaUrls.map(async (url) => ({
                url,
                mimeType: guessMime(url, post.mediaType as SocialMediaType),
                bytesB64: needsBytes ? bufferToBase64(await readStorageBytes(url)) : undefined,
              })),
            );
            return {
              content: post.content,
              mediaType: post.mediaType as SocialMediaType,
              platform: post.platform as SocialPlatform,
              connector: account.connector as ConnectorId,
              accountExternalId: account.externalId,
              accountType: account.accountType as "organization" | "person",
              accessToken: account.accessToken,
              media,
              scheduledForIso,
            };
          }),
        ),
      );

      // ── Step 3: publish (with retry) ────────────────────────────────
      // Step results are JSON-serialised between steps, so binary bytes
      // round-trip as base64 strings via `bytesB64`. Decoding happens here
      // before the provider call.
      const result = await step.do(
        "publish",
        {
          retries: { limit: 3, delay: "20 seconds", backoff: "exponential" },
          timeout: "1 minute",
        },
        async () =>
          trace("publish", postId, async () =>
            inScope(async () => {
              const provider = getProvider(prepared.connector);
              const media = prepared.media.map((m) => ({
                url: m.url,
                mimeType: m.mimeType,
                bytes: m.bytesB64 ? base64ToBuffer(m.bytesB64) : undefined,
              }));
              return provider.publish({
                account: {
                  externalId: prepared.accountExternalId,
                  accountType: prepared.accountType,
                  accessToken: prepared.accessToken,
                  platform: prepared.platform,
                },
                content: prepared.content,
                mediaType: prepared.mediaType,
                media,
                scheduledFor: prepared.scheduledForIso
                  ? new Date(prepared.scheduledForIso)
                  : undefined,
              });
            }),
          ),
      );

      // ── Step 4: finalize ────────────────────────────────────────────
      // A delegated handoff (scheduledForIso set) isn't live yet — the
      // connector will fire it later. Keep it "scheduled" but stamp the
      // external id/url so the cron skips re-publishing it (see
      // publishDueScheduled's externalId filter) and can reconcile it to
      // "published" once its time passes. A normal publish goes straight to
      // "published".
      await step.do("finalize", async () =>
        trace("finalize", postId, async () =>
          inScope(async () => {
            const delegated = prepared.scheduledForIso != null;
            await (await getPrisma()).socialPost.update({
              where: { id: postId },
              data: {
                status: delegated ? "scheduled" : "published",
                publishedAt: delegated ? null : new Date(),
                externalId: result.externalId,
                externalUrl: result.externalUrl,
                errorMessage: null,
              },
            });
          }),
        ),
      );
    } catch (err) {
      // All retries exhausted (or a non-retryable error). Persist the
      // failure so the UI can show it; best-effort because if the DB is
      // itself the issue, the periodic `resetStuckPublishing` cron is the
      // last-resort recovery.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[publish-post-workflow] post ${event.payload.postId} failed:`, err);
      await inScope(async () => {
        await (await getPrisma()).socialPost.update({
          where: { id: event.payload.postId },
          data: { status: "failed", errorMessage: message.slice(0, 1000) },
        });
      }).catch((updateErr) => {
        console.error(
          `[publish-post-workflow] failed to mark ${event.payload.postId} as failed:`,
          updateErr,
        );
      });
      throw err;
    }
  }
}

// ── base64 helpers (Workflows step boundaries serialise via JSON) ──────────

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // btoa expects a binary string; do it in chunks to avoid the
  // "max call stack" crash from spreading a >100k Uint8Array into
  // String.fromCharCode.
  const CHUNK = 32_768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
