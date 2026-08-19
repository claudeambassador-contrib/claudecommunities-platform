import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import {
  claimPostForPublish,
  completeClaimedPublish,
  getPostForPublish,
  markPublishFailed,
} from "@/modules/social/services/socialService";
import { zernioConnectorFromEnv } from "@/modules/social/zernioConnector";
import { createTenantDb, getD1Binding } from "@/shared/db/client";
import { tenantStore } from "@/shared/db/tenantStore";

interface Payload {
  d1Binding: string;
  orgId: string;
  postId: string;
}

function openStore(env: Env, payload: Payload) {
  const d1 = getD1Binding(env as unknown as Record<string, unknown>, payload.d1Binding);
  return tenantStore(createTenantDb(d1), {
    binding: payload.d1Binding,
    orgId: payload.orgId,
  });
}

/**
 * Durable social publish. Claims the row, calls the connector, then writes
 * the real externalId. No stub ids — a missing connector fails the post.
 */
export class PublishPostWorkflow extends WorkflowEntrypoint<Env, Payload> {
  async run(event: WorkflowEvent<Payload>, step: WorkflowStep) {
    const { postId } = event.payload;

    const claimed = await step.do("claim", async () => {
      const store = openStore(this.env, event.payload);
      const result = await claimPostForPublish(store, postId);
      if (!result.ok) {
        throw new Error(result.error.message ?? result.error.code);
      }
      return { attempt: result.attempt, claimed: result.claimed, postId };
    });

    const published = await step.do("publish", async () => {
      const store = openStore(this.env, event.payload);
      const existing = await getPostForPublish(store, postId);
      if (!existing.ok) {
        throw new Error(existing.error.message ?? existing.error.code);
      }
      if (!claimed.claimed && existing.post.externalId) {
        return {
          externalId: existing.post.externalId,
          externalUrl: existing.post.externalUrl,
          status: existing.post.status,
        };
      }
      const connector = zernioConnectorFromEnv(this.env as unknown as Record<string, unknown>);
      if (!connector) {
        await markPublishFailed(store, postId, "No social connector is configured on this Worker");
        throw new Error("No social connector is configured on this Worker");
      }
      const result = await completeClaimedPublish(store, existing.post, connector);
      if (!result.ok) {
        throw new Error(result.error.message ?? result.error.code);
      }
      if (!result.post.externalId) {
        throw new Error("Connector published without an externalId");
      }
      return {
        externalId: result.post.externalId,
        externalUrl: result.post.externalUrl,
        status: result.post.status,
      };
    });

    await step.do("finalize", async () => ({
      externalId: published.externalId,
      status: published.status,
    }));

    return published;
  }
}
