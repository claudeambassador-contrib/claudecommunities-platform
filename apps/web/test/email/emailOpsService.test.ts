import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createCampaign,
  getCampaign,
  updateCampaign,
} from "@/modules/email/services/emailCampaignsService";
import {
  createAutomation,
  getEmailAnalytics,
  getEmailSettings,
  listAutomations,
  saveEmailSettings,
  setAutomationStatus,
} from "@/modules/email/services/emailOpsService";
import { EMAIL_SETTINGS_DEFAULTS } from "@/modules/email/types";

import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("emailCampaignsService builder", () => {
  it("creates, reads, and updates a draft campaign", async () => {
    const store = openMemoryTenant();
    const created = await createCampaign(store, adminActor(), {
      bodyHtml: "<p>Hi</p>",
      name: "Welcome",
      subject: "Hello",
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    const loaded = await getCampaign(store, adminActor(), created.campaign.id);
    expect(loaded.ok && loaded.campaign.subject).toBe("Hello");

    const updated = await updateCampaign(store, adminActor(), created.campaign.id, {
      bodyHtml: "<h1>Updated</h1>",
      subject: "Updated subject",
    });
    expect(updated.ok && updated.campaign.subject).toBe("Updated subject");
    expect(updated.ok && updated.campaign.bodyHtml).toBe("<h1>Updated</h1>");
  });
});

describe("emailOpsService", () => {
  it("creates and lists automations for admins only", async () => {
    const store = openMemoryTenant();
    const deniedList = await listAutomations(store, memberActor());
    expect(deniedList.ok).toBeFalsy();
    if (!deniedList.ok) {
      expect(deniedList.error.status).toBe(403);
    }

    const denied = await createAutomation(store, memberActor(), {
      name: "Welcome",
      triggerType: "signup",
    });
    expect(denied.ok).toBeFalsy();
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const created = await createAutomation(store, adminActor(), {
      name: "Welcome",
      triggerType: "signup",
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.automation.name).toBe("Welcome");
    expect(created.automation.triggerType).toBe("signup");
    expect(created.automation.status).toBe("draft");
    expect(created.automation.id.startsWith("ea_")).toBeTruthy();

    const listed = await listAutomations(store, adminActor());
    expect(listed.ok).toBeTruthy();
    if (listed.ok) {
      expect(listed.automations.map((row) => row.name)).toStrictEqual(["Welcome"]);
    }

    const invalid = await createAutomation(store, adminActor(), {
      name: "Bad",
      triggerType: "unknown",
    });
    expect(invalid.ok).toBeFalsy();

    const deniedStatus = await setAutomationStatus(
      store,
      memberActor(),
      created.automation.id,
      "active",
    );
    expect(deniedStatus.ok).toBeFalsy();
    if (!deniedStatus.ok) {
      expect(deniedStatus.error.status).toBe(403);
    }

    const activated = await setAutomationStatus(
      store,
      adminActor(),
      created.automation.id,
      "active",
    );
    expect(activated.ok).toBeTruthy();
    if (activated.ok) {
      expect(activated.automation.status).toBe("active");
    }
  });

  it("returns settings defaults without inserting a row", async () => {
    const store = openMemoryTenant();
    const denied = await getEmailSettings(store, memberActor());
    expect(denied.ok).toBeFalsy();
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const loaded = await getEmailSettings(store, adminActor());
    expect(loaded.ok).toBeTruthy();
    if (!loaded.ok) {
      return;
    }
    expect(loaded.settings).toStrictEqual(EMAIL_SETTINGS_DEFAULTS);

    const rows = await store.db
      .select()
      .from(store.tables.emailSettings)
      .where(eq(store.tables.emailSettings.orgId, store.orgId));
    expect(rows).toHaveLength(0);

    const deniedSave = await saveEmailSettings(store, memberActor(), {
      senderEmail: "hello@example.com",
      senderName: "Hello",
    });
    expect(deniedSave.ok).toBeFalsy();
    if (!deniedSave.ok) {
      expect(deniedSave.error.status).toBe(403);
    }

    const badEmail = await saveEmailSettings(store, adminActor(), {
      senderEmail: "not-an-email",
      senderName: "Hello",
    });
    expect(badEmail.ok).toBeFalsy();

    const saved = await saveEmailSettings(store, adminActor(), {
      senderEmail: "hello@example.com",
      senderName: "Hello",
      trackClicks: false,
      trackOpens: true,
    });
    expect(saved.ok).toBeTruthy();
    if (!saved.ok) {
      return;
    }
    expect(saved.settings.id?.startsWith("es_")).toBeTruthy();
    expect(saved.settings.senderEmail).toBe("hello@example.com");
    expect(saved.settings.trackClicks).toBeFalsy();

    const persisted = await store.db
      .select()
      .from(store.tables.emailSettings)
      .where(eq(store.tables.emailSettings.orgId, store.orgId));
    expect(persisted).toHaveLength(1);

    const partial = await saveEmailSettings(store, adminActor(), { senderName: "Updated" });
    expect(partial.ok).toBeTruthy();
    if (partial.ok) {
      expect(partial.settings.senderName).toBe("Updated");
      expect(partial.settings.senderEmail).toBe("hello@example.com");
      expect(partial.settings.trackClicks).toBeFalsy();
    }
  });

  it("returns analytics zeros then counts after a send row", async () => {
    const store = openMemoryTenant();
    const denied = await getEmailAnalytics(store, memberActor());
    expect(denied.ok).toBeFalsy();
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const empty = await getEmailAnalytics(store, adminActor());
    expect(empty.ok).toBeTruthy();
    if (!empty.ok) {
      return;
    }
    expect(empty.totalSends).toBe(0);
    expect(empty.queued).toBe(0);
    expect(empty.byCampaign).toStrictEqual([]);

    const campaign = await createCampaign(store, adminActor(), {
      name: "Blast",
      subject: "Hi",
    });
    expect(campaign.ok).toBeTruthy();
    if (!campaign.ok) {
      return;
    }

    await store.db.insert(store.tables.emailSends).values({
      campaignId: campaign.campaign.id,
      createdAt: new Date(),
      id: "snd_1",
      orgId: store.orgId,
      status: "queued",
      toEmail: "a@example.com",
    });

    const after = await getEmailAnalytics(store, adminActor());
    expect(after.ok).toBeTruthy();
    if (!after.ok) {
      return;
    }
    expect(after.totalSends).toBe(1);
    expect(after.queued).toBe(1);
    expect(after.byCampaign).toStrictEqual([{ campaignId: campaign.campaign.id, sent: 1 }]);
  });
});
