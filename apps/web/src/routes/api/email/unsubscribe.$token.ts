import { createFileRoute } from "@tanstack/react-router";

import {
  emailSigningSecret,
  unsubscribeEmail,
  verifyUnsubscribeToken,
} from "@/modules/email/services/emailWebhookService";
import { getRegistryStore, workerEnv } from "@/shared/db/env";

export const Route = createFileRoute("/api/email/unsubscribe/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const secret = emailSigningSecret(workerEnv());
        if (!secret) {
          return new Response("Unsubscribe is not configured.", { status: 503 });
        }
        const email = verifyUnsubscribeToken(params.token, secret);
        if (!email) {
          return new Response("Invalid unsubscribe link.", { status: 400 });
        }
        const result = await unsubscribeEmail(getRegistryStore(), email);
        if (!result.ok && result.error.status !== 404) {
          return new Response("Could not unsubscribe.", { status: 500 });
        }
        return new Response("You have been unsubscribed from campaign email.", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
