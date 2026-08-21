import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import { sendCampaign } from "@/modules/email/services/emailSendService";
import { resendTransportFromEnv } from "@/modules/email/transport";
import { createRegistryDb, createTenantDb, getD1Binding } from "@/shared/db/client";
import { registryStore } from "@/shared/db/registryStore";
import { tenantStore } from "@/shared/db/tenantStore";

interface Payload {
  campaignId: string;
  d1Binding: string;
  orgId: string;
}

function openStores(env: Env, payload: Payload) {
  const record = env as unknown as Record<string, unknown>;
  const d1 = getD1Binding(record, payload.d1Binding);
  return {
    registry: registryStore(createRegistryDb(getD1Binding(record, "REGISTRY"))),
    store: tenantStore(createTenantDb(d1), {
      binding: payload.d1Binding,
      orgId: payload.orgId,
    }),
  };
}

/**
 * Durable campaign send. The service writes email_sends and finalizes the
 * campaign; this workflow only opens stores and retries the send step.
 */
export class CampaignSendWorkflow extends WorkflowEntrypoint<Env, Payload> {
  async run(event: WorkflowEvent<Payload>, step: WorkflowStep) {
    const { campaignId } = event.payload;

    await step.do("claim", async () => ({ campaignId, status: "sending" as const }));

    const summary = await step.do("send-batch", async () => {
      const { registry, store } = openStores(this.env, event.payload);
      const transport = resendTransportFromEnv(this.env as unknown as Record<string, unknown>);
      if (!transport) {
        throw new Error("RESEND_API_KEY is not configured");
      }
      const result = await sendCampaign(store, registry, campaignId, transport);
      if (!result.ok) {
        throw new Error(result.error.message ?? result.error.code);
      }
      return { failed: result.failed, sent: result.sent, skipped: result.skipped };
    });

    await step.do("finalize", async () => ({ status: "sent" as const, ...summary }));
    return summary;
  }
}
