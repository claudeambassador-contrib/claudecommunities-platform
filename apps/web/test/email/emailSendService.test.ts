import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createCampaign, getCampaign } from "@/modules/email/services/emailCampaignsService";
import { sendCampaign } from "@/modules/email/services/emailSendService";
import type { EmailTransport } from "@/modules/email/transport";
import { insertMembership, insertUser } from "@/modules/identity/repositories/directoryRepository";
import { getRegionConfig } from "@/shared/region";
import { openMemoryRegistry } from "../helpers/registry";
import { adminActor, openMemoryTenant } from "../helpers/tenant";

const ORG = "org_test";

async function seedMember(
  registry: ReturnType<typeof openMemoryRegistry>,
  input: { clerk: string; email: string; name: string; banned?: boolean },
) {
  const user = await insertUser(registry, {
    clerkUserId: input.clerk,
    displayName: input.name,
    email: input.email,
  });
  await insertMembership(registry, { orgId: ORG, userId: user.id });
  if (input.banned) {
    await registry.db
      .update(registry.tables.users)
      .set({ isBanned: true })
      .where(eq(registry.tables.users.id, user.id));
  }
  return user;
}

function recordingTransport(): EmailTransport & { from: string[]; to: string[] } {
  const to: string[] = [];
  const from: string[] = [];
  return {
    from,
    to,
    async sendBatch(messages) {
      from.push(...messages.map((message) => message.from));
      to.push(...messages.map((message) => message.to));
      return messages.map((message) => ({
        email: message.to,
        id: `re_${message.to}`,
        ok: true,
      }));
    },
  };
}

describe("emailSendService", () => {
  it("sends to members, skips banned and already-sent, and marks the campaign sent", async () => {
    const store = openMemoryTenant(ORG);
    const registry = openMemoryRegistry();
    await seedMember(registry, { clerk: "clk_ada", email: "ada@example.com", name: "Ada" });
    const already = await seedMember(registry, {
      clerk: "clk_al",
      email: "al@example.com",
      name: "Al",
    });
    await seedMember(registry, {
      banned: true,
      clerk: "clk_ban",
      email: "ban@example.com",
      name: "Ban",
    });

    const created = await createCampaign(store, adminActor(), {
      bodyHtml: "<p>Hello</p>",
      name: "Blast",
      subject: "News",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await store.db.insert(store.tables.emailSends).values({
      campaignId: created.campaign.id,
      createdAt: new Date(),
      id: "esnd_existing",
      orgId: store.orgId,
      status: "sent",
      toEmail: already.email,
    });

    const transport = recordingTransport();
    const result = await sendCampaign(store, registry, created.campaign.id, transport);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result).toMatchObject({ failed: 0, sent: 1, skipped: 1 });
    expect(transport.to).toEqual(["ada@example.com"]);
    expect(transport.from[0]).toBe(`hello@${getRegionConfig().senderDomain}`);

    const loaded = await getCampaign(store, adminActor(), created.campaign.id);
    expect(loaded.ok && loaded.campaign.status).toBe("sent");

    const rows = await store.db
      .select()
      .from(store.tables.emailSends)
      .where(eq(store.tables.emailSends.campaignId, created.campaign.id));
    const ada = rows.find((row) => row.toEmail === "ada@example.com");
    expect(ada?.status).toBe("sent");
    expect(ada?.externalId).toBe("re_ada@example.com");
  });

  it("404s a missing campaign", async () => {
    const store = openMemoryTenant(ORG);
    const registry = openMemoryRegistry();
    const result = await sendCampaign(store, registry, "cmp_missing", recordingTransport());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(404);
    }
  });
});
