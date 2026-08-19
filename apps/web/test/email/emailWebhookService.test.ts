import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createCampaign } from "@/modules/email/services/emailCampaignsService";
import { sendCampaign } from "@/modules/email/services/emailSendService";
import {
  applyResendEvent,
  signUnsubscribeToken,
  unsubscribeEmail,
  verifyUnsubscribeToken,
} from "@/modules/email/services/emailWebhookService";
import type { EmailTransport } from "@/modules/email/transport";
import {
  insertMembership,
  insertUser,
  listOrgRecipients,
} from "@/modules/identity/repositories/directoryRepository";
import { openMemoryRegistry } from "../helpers/registry";
import { adminActor, openMemoryTenant } from "../helpers/tenant";

const ORG = "org_test";
const SECRET = "test-signing-secret";

const okTransport: EmailTransport = {
  sendBatch: (messages) =>
    Promise.resolve(
      messages.map((message) => ({ email: message.to, id: `re_${message.to}`, ok: true })),
    ),
};

describe("emailWebhookService", () => {
  it("marks a send bounced from a Resend event id", async () => {
    const store = openMemoryTenant(ORG);
    await store.db.insert(store.tables.emailSends).values({
      campaignId: null,
      createdAt: new Date(),
      externalId: "re_bounce",
      id: "esnd_1",
      orgId: ORG,
      status: "sent",
      toEmail: "ada@example.com",
    });

    const ignored = await applyResendEvent(store, { resendId: "re_bounce", type: "email.opened" });
    expect(ignored.ok && ignored.updated).toBe(false);

    const bounced = await applyResendEvent(store, { resendId: "re_bounce", type: "email.bounced" });
    expect(bounced.ok && bounced.updated).toBe(true);
    if (bounced.ok) {
      expect(bounced.status).toBe("bounced");
    }

    const [row] = await store.db
      .select()
      .from(store.tables.emailSends)
      .where(eq(store.tables.emailSends.id, "esnd_1"));
    expect(row?.status).toBe("bounced");
  });

  it("unsubscribes an email so it leaves the recipient list", async () => {
    const store = openMemoryTenant(ORG);
    const registry = openMemoryRegistry();
    const ada = await insertUser(registry, {
      clerkUserId: "clk_ada",
      displayName: "Ada",
      email: "ada@example.com",
    });
    await insertMembership(registry, { orgId: ORG, userId: ada.id });

    expect(await listOrgRecipients(registry, ORG)).toEqual([
      { email: "ada@example.com", id: ada.id },
    ]);

    const token = signUnsubscribeToken(ada.email, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe("ada@example.com");
    expect(verifyUnsubscribeToken(token, "other")).toBeNull();

    const unsubscribed = await unsubscribeEmail(registry, ada.email);
    expect(unsubscribed.ok).toBe(true);
    expect(await listOrgRecipients(registry, ORG)).toEqual([]);

    const created = await createCampaign(store, adminActor(), {
      name: "Blast",
      subject: "News",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const sent = await sendCampaign(store, registry, created.campaign.id, okTransport);
    expect(sent.ok && sent.sent).toBe(0);
    expect(sent.ok && sent.skipped).toBe(0);
  });
});
