import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

type Payload = { campaignId: string; orgId: string; d1Binding: string };

export class CampaignSendWorkflow extends WorkflowEntrypoint<Env, Payload> {
  async run(event: WorkflowEvent<Payload>, step: WorkflowStep) {
    const { campaignId } = event.payload;

    await step.do("claim", async () => ({ campaignId, status: "sending" }));
    await step.do("send-batch", async () => {
      // Resend/Send16 batching lands in email module slice.
      return { sent: 0 };
    });
    await step.do("finalize", async () => ({ status: "sent" as const }));
  }
}
