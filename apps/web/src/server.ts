import handler from "@tanstack/react-start/server-entry";
import { handleScheduled } from "./worker-scheduled";
export { CampaignSendWorkflow } from "./workflows/campaign-send";
export { PublishPostWorkflow } from "./workflows/publish-post";
export { SlideExportWorkflow } from "./workflows/slide-export";

export default {
  fetch: handler.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    return handleScheduled(event, env as unknown as Record<string, unknown>, ctx);
  },
};
