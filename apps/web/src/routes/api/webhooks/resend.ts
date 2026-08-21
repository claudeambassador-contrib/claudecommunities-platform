import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import {
  applyResendEvent,
  verifySvixSignature,
} from "@/modules/email/services/emailWebhookService";
import { tenants } from "@/modules/tenants/schema.registry";
import { getRegistryDb, openTenantStore, workerEnv } from "@/shared/db/env";

export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = workerEnv();
        const secret = String(env.RESEND_WEBHOOK_SECRET ?? "").trim();
        if (!secret) {
          return Response.json({ error: "Webhook not configured" }, { status: 500 });
        }

        const svixId = request.headers.get("svix-id");
        const svixTimestamp = request.headers.get("svix-timestamp");
        const svixSignature = request.headers.get("svix-signature");
        if (!(svixId && svixTimestamp && svixSignature)) {
          return Response.json({ error: "Missing signature headers" }, { status: 401 });
        }

        const rawBody = await request.text();
        if (!verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        const body = JSON.parse(rawBody) as {
          data?: { email_id?: string };
          type?: string;
        };
        const resendId = body.data?.email_id?.trim() ?? "";
        const type = body.type ?? "";
        if (!resendId) {
          return Response.json({ received: true });
        }

        const registryDb = getRegistryDb();
        const cities = await registryDb.select().from(tenants).where(eq(tenants.status, "active"));
        for (const city of cities) {
          const store = openTenantStore(city);
          // oxlint-disable-next-line no-await-in-loop -- stop after the city that owns the send
          const applied = await applyResendEvent(store, { resendId, type });
          if (applied.ok && applied.updated) {
            return Response.json({ received: true, updated: true });
          }
        }
        return Response.json({ received: true, updated: false });
      },
    },
  },
});
