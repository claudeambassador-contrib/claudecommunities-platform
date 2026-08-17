import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

type Payload = { postId: string; orgId: string; d1Binding: string };

/**
 * Durable social publish — stub ready for connector wiring (LinkedIn / Zernio).
 * Exported from src/server.ts (no OpenNext inject script needed).
 */
export class PublishPostWorkflow extends WorkflowEntrypoint<Env, Payload> {
  async run(event: WorkflowEvent<Payload>, step: WorkflowStep) {
    const { postId, orgId, d1Binding } = event.payload;

    await step.do("claim", async () => {
      return { postId, orgId, d1Binding, claimedAt: Date.now() };
    });

    await step.do("publish", async () => {
      // Connector publish lands here in a later slice.
      return { published: true, externalId: `stub_${postId}` };
    });

    await step.do("finalize", async () => {
      return { status: "published" as const };
    });
  }
}
