import handler from "@tanstack/react-start/server-entry";

import { handleScheduled } from "./worker-scheduled";

// oxlint-disable-next-line oxc/no-barrel-file -- workflow classes must be re-exported for wrangler/OpenNext bindings (scripts/inject-workflow-exports.mjs)
export { CampaignSendWorkflow } from "./workflows/campaign-send";
export { PublishPostWorkflow } from "./workflows/publish-post";
export { SlideExportWorkflow } from "./workflows/slide-export";

export default {
  fetch: handler.fetch,
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    return handleScheduled(event, env as unknown as Record<string, unknown>, ctx);
  },
};
