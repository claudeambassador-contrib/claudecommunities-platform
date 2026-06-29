/**
 * Cloudflare Worker scheduled handler.
 *
 * Wired into the default export of `.open-next/worker.js` by
 * scripts/inject-workflow-exports.mjs after the OpenNext build. The
 * cadence is driven by the `triggers.crons` entries in `wrangler.jsonc`.
 *
 * Today it runs one job per tick:
 *  - publish-scheduled-posts: drain due scheduled SocialPosts (kicks off
 *    a PublishPostWorkflow instance for each) and reset rows stuck in
 *    'publishing' beyond the safety threshold.
 *
 * Workflow dispatches happen inside, not after — `await` keeps the
 * scheduled invocation alive until the dispatches resolve, so Cloudflare
 * sees a successful run.
 *
 * If more cron jobs are added later, branch on `controller.cron`
 * (each `triggers.crons` entry has its own pattern).
 */
import { runWithEnv } from "@/lib/cf-env";
import {
  publishDueScheduled,
  reconcileDelegatedScheduled,
  resetStuckPublishing,
} from "@/lib/services/socialPosts";

interface ScheduledController {
  cron: string;
  scheduledTime: number;
  noRetry?: () => void;
}

export async function handleScheduled(
  controller: ScheduledController,
  env: CloudflareEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  await runWithEnv(env, async () => {
    try {
      const reset = await resetStuckPublishing();
      const reconciled = await reconcileDelegatedScheduled();
      const { dispatched, errors } = await publishDueScheduled();
      // biome-ignore lint/suspicious/noConsole: intentional per-tick cron summary for Worker log observability
      console.log(
        `[cron] tick cron='${controller.cron}': reset=${reset} stuck row(s), reconciled=${reconciled} delegated post(s), dispatched=${dispatched.length} due post(s), errors=${errors.length}`,
      );
      for (const e of errors) {
        console.error(`[cron] dispatch error for post ${e.id}: ${e.error}`);
      }
    } catch (err) {
      console.error("[cron] handleScheduled error:", err);
      throw err;
    }
  });
}
