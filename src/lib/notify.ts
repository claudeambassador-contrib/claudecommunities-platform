/**
 * Cross-service notifications.
 *
 * Publishes a notification envelope to the shared `app-notifications` queue.
 * The cloudflare-build-notifications worker consumes that queue and routes each
 * message to the right Slack channel based on its `type`.
 *
 * This is intentionally separate from `notifications.ts`, which manages
 * in-app, user-facing notifications stored in the database.
 *
 * Contract (keep in sync with the consumer's `NotificationMessage`):
 *   { type: "<namespace>.<event>", data: { ...type-specific } }
 *
 * Best-effort: failures are logged and swallowed so notifications never break
 * the originating request.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEnvAsync } from "@/lib/cf-env";

export interface NotificationMessage {
  /** Namespaced, stable event type, e.g. "community.talk_submission.submitted". */
  type: string;
  data: Record<string, unknown>;
}

interface QueueProducer {
  send: (body: unknown) => Promise<void>;
}

async function deliver(message: NotificationMessage): Promise<void> {
  const env = await getEnvAsync();
  // The binding type isn't in the generated CloudflareEnv until `cf-typegen`
  // runs; access defensively (mirrors how db.ts reaches DB).
  const queue = (env as Record<string, unknown>).NOTIFICATIONS as QueueProducer | undefined;
  if (!queue) {
    console.warn(`NOTIFICATIONS queue not bound; skipping "${message.type}"`);
    return;
  }
  await queue.send(message);
}

/**
 * Fire-and-forget: returns immediately and never throws. The queue send runs
 * in the background, kept alive past the response by `ctx.waitUntil` where
 * available, and any failure is logged so it can't break the originating
 * request.
 */
export function publishNotification(message: NotificationMessage): void {
  const delivery = deliver(message).catch((err) => {
    console.error("Failed to publish notification:", err);
  });
  try {
    getCloudflareContext().ctx.waitUntil(delivery);
  } catch {
    // No request-scoped execution context (e.g. inside a workflow). The
    // promise still runs on its own; there's just no ctx to extend lifetime.
  }
}
