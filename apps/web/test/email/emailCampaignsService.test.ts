import { describe, expect, it } from "vitest";
import {
  createCampaign,
  createTemplate,
  enqueueCampaignSend,
  listCampaigns,
  listDueScheduled,
  listTemplates,
} from "@/modules/email/services/emailCampaignsService";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("emailCampaignsService", () => {
  it("creates and lists campaigns for admins only", async () => {
    const store = openMemoryTenant();
    const denied = await createCampaign(store, memberActor(), {
      name: "Nope",
      subject: "Hi",
    });
    expect(denied.ok).toBe(false);

    const created = await createCampaign(store, adminActor(), {
      bodyHtml: "<p>Hello</p>",
      name: "Welcome",
      subject: "Welcome",
    });
    expect(created.ok).toBe(true);
    const listed = await listCampaigns(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.campaigns).toHaveLength(1);
    expect(listed.campaigns[0]?.status).toBe("draft");
  });

  it("enqueues a draft via the workflow port and rejects a second send", async () => {
    const store = openMemoryTenant();
    const created = await createCampaign(store, adminActor(), {
      name: "Blast",
      subject: "News",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const started: Array<{ campaignId: string; d1Binding: string; orgId: string }> = [];
    const queued = await enqueueCampaignSend(store, adminActor(), created.campaign.id, {
      start: (input) => {
        started.push(input);
        return Promise.resolve({ workflowId: "wf_1" });
      },
    });
    expect(queued.ok).toBe(true);
    if (!queued.ok) {
      return;
    }
    expect(queued.workflowId).toBe("wf_1");
    expect(started).toEqual([
      { campaignId: created.campaign.id, d1Binding: store.binding, orgId: store.orgId },
    ]);

    const listed = await listCampaigns(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.campaigns[0]?.status).toBe("sending");

    const again = await enqueueCampaignSend(store, adminActor(), created.campaign.id, {
      start: ({ campaignId }) => Promise.resolve({ workflowId: `wf_${campaignId}` }),
    });
    expect(again.ok).toBe(false);
  });

  it("lists due scheduled campaigns for the cron drain", async () => {
    const store = openMemoryTenant();
    const due = await createCampaign(store, adminActor(), {
      name: "Due",
      scheduledAt: "2026-01-01T00:00:00.000Z",
      subject: "Due",
    });
    const later = await createCampaign(store, adminActor(), {
      name: "Later",
      scheduledAt: "2026-12-01T00:00:00.000Z",
      subject: "Later",
    });
    expect(due.ok && later.ok).toBe(true);

    const drain = await listDueScheduled(store, new Date("2026-06-01T00:00:00.000Z"));
    expect(drain.ok).toBe(true);
    if (!drain.ok) {
      return;
    }
    expect(drain.campaigns.map((c) => c.name)).toEqual(["Due"]);
  });

  it("creates templates", async () => {
    const store = openMemoryTenant();
    const created = await createTemplate(store, adminActor(), {
      bodyHtml: "<p>T</p>",
      name: "Base",
      subject: "Sub",
    });
    expect(created.ok).toBe(true);
    const listed = await listTemplates(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.templates[0]?.name).toBe("Base");
  });
});
