import { describe, expect, it } from "vitest";
import {
  getSlideExportJobStatus,
  listExportJobs,
  startSlideExportJob,
  tryShortCircuitCachedExport,
} from "@/modules/slides/services/slideExportService";
import {
  createPreset,
  deletePreset,
  getPreset,
  getState,
  listPresets,
  putState,
  updatePreset,
} from "@/modules/slides/services/slideGeneratorService";
import type {
  SlideExportWorkflowPort,
  SlideRenderCache,
  StartExportInput,
} from "@/modules/slides/types";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

const TEMPLATE = { accent: "#d97757", name: "Talk card" };
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T/;

function exportInput(overrides: Partial<StartExportInput> = {}): StartExportInput {
  return {
    eventId: "evt_1",
    filenameBase: "meetup slides",
    slideIds: ["slide_talk"],
    speakerIds: ["spk_ada"],
    ...overrides,
  };
}

function silentWorkflow(): SlideExportWorkflowPort {
  return {
    create: () => Promise.resolve(),
  };
}

describe("slideGeneratorService", () => {
  it("returns empty state for an unused scope and rejects members", async () => {
    const store = openMemoryTenant();
    const denied = await getState(store, memberActor(), "global");
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const empty = await getState(store, adminActor(), "global");
    expect(empty.ok).toBe(true);
    if (!empty.ok) {
      return;
    }
    expect(empty.state).toEqual({ data: null, scope: "global", updatedAt: null });
  });

  it("upserts generator state for global and event scopes", async () => {
    const store = openMemoryTenant();
    const scopes: string[] = [];
    const saved = await putState(store, adminActor(), "event:evt_1", TEMPLATE, {
      invalidateForScope: (scope) => {
        scopes.push(scope);
        return Promise.resolve();
      },
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    expect(saved.scope).toBe("event:evt_1");
    expect(saved.updatedAt).toMatch(ISO_PREFIX);
    expect(scopes).toEqual(["event:evt_1"]);

    const again = await putState(store, adminActor(), "event:evt_1", {
      ...TEMPLATE,
      accent: "#111111",
    });
    expect(again.ok).toBe(true);

    const loaded = await getState(store, adminActor(), "event:evt_1");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.state.data).toEqual({ accent: "#111111", name: "Talk card" });
    expect(loaded.state.scope).toBe("event:evt_1");
    expect(loaded.state.updatedAt).toBeTruthy();
  });

  it("treats a unique race on first save as an update", async () => {
    const store = openMemoryTenant();
    const [a, b] = await Promise.all([
      putState(store, adminActor(), "global", { name: "A" }),
      putState(store, adminActor(), "global", { name: "B" }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const loaded = await getState(store, adminActor(), "global");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.data).toEqual(expect.objectContaining({ name: expect.any(String) }));
    }
  });

  it("rejects invalid scopes and oversized bodies", async () => {
    const store = openMemoryTenant();
    const actor = adminActor();
    const badScope = await putState(store, actor, "city:sydney", TEMPLATE);
    expect(badScope.ok).toBe(false);
    if (!badScope.ok) {
      expect(badScope.error.status).toBe(400);
    }

    const emptyEvent = await putState(store, actor, "event:", TEMPLATE);
    expect(emptyEvent.ok).toBe(false);

    const huge = await putState(store, actor, "global", "x".repeat(256 * 1024 + 1));
    expect(huge.ok).toBe(false);
    if (!huge.ok) {
      expect(huge.error.status).toBe(400);
    }
  });

  it("creates, lists, updates, and deletes named style presets", async () => {
    const store = openMemoryTenant();
    const actor = adminActor();

    const created = await createPreset(store, actor, { data: TEMPLATE, name: " Sunset " });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.preset).toEqual({ id: created.preset.id, name: "Sunset" });

    const listed = await listPresets(store, actor);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.presets).toHaveLength(1);
    expect(listed.presets[0]?.data).toEqual(TEMPLATE);

    const fetched = await getPreset(store, actor, created.preset.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.preset.name).toBe("Sunset");

    const renamed = await updatePreset(store, actor, created.preset.id, { name: "Dawn" });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) {
      return;
    }
    expect(renamed.preset.name).toBe("Dawn");

    const removed = await deletePreset(store, actor, created.preset.id);
    expect(removed.ok).toBe(true);
    const missing = await getPreset(store, actor, created.preset.id);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.status).toBe(404);
    }
  });

  it("rejects duplicate preset names and member writes", async () => {
    const store = openMemoryTenant();
    const first = await createPreset(store, adminActor(), { data: TEMPLATE, name: "Brand" });
    expect(first.ok).toBe(true);

    const clash = await createPreset(store, adminActor(), { data: TEMPLATE, name: "Brand" });
    expect(clash.ok).toBe(false);
    if (!clash.ok) {
      expect(clash.error.status).toBe(409);
    }

    const denied = await createPreset(store, memberActor(), { data: TEMPLATE, name: "Nope" });
    expect(denied.ok).toBe(false);

    const emptyName = await createPreset(store, adminActor(), { data: TEMPLATE, name: "  " });
    expect(emptyName.ok).toBe(false);
    if (!emptyName.ok) {
      expect(emptyName.error.status).toBe(400);
    }
  });
});

describe("slideExportService", () => {
  it("starts a queued export job through the workflow port", async () => {
    const store = openMemoryTenant();
    const created: string[] = [];
    const started = await startSlideExportJob(store, adminActor(), exportInput(), {
      workflow: {
        create: (params) => {
          created.push(params.jobId);
          expect(params.eventId).toBe("evt_1");
          expect(params.filenameBase).toBe("meetup_slides");
          expect(params.refWidth).toBe(600);
          expect(params.totalPairs).toBe(1);
          return Promise.resolve();
        },
      },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(created).toEqual([started.jobId]);

    const listed = await listExportJobs(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.jobs).toEqual([{ id: started.jobId, status: "queued" }]);

    const status = await getSlideExportJobStatus(store, adminActor(), started.jobId);
    expect(status.ok).toBe(true);
    if (!status.ok) {
      return;
    }
    expect(status.job.status).toBe("queued");
    expect(status.job.totalCount).toBe(1);
    expect(status.job.completedCount).toBe(0);
  });

  it("rejects oversized batches, missing workflow, and members", async () => {
    const store = openMemoryTenant();
    const tooMany = await startSlideExportJob(
      store,
      adminActor(),
      exportInput({
        slideIds: Array.from({ length: 20 }, (_, i) => `s${i}`),
        speakerIds: Array.from({ length: 11 }, (_, i) => `p${i}`),
      }),
      { workflow: silentWorkflow() },
    );
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.error.status).toBe(400);
    }

    const denied = await startSlideExportJob(store, memberActor(), exportInput(), {
      workflow: silentWorkflow(),
    });
    expect(denied.ok).toBe(false);

    const listed = await listExportJobs(store, memberActor());
    expect(listed.ok).toBe(false);
  });

  it("marks the job failed when workflow create rejects", async () => {
    const store = openMemoryTenant();
    const started = await startSlideExportJob(store, adminActor(), exportInput(), {
      workflow: {
        create: () => Promise.reject(new Error("SLIDE_EXPORT missing")),
      },
    });
    expect(started.ok).toBe(false);
    if (!started.ok) {
      expect(started.error.status).toBe(503);
    }

    const listed = await listExportJobs(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.jobs[0]?.status).toBe("failed");
  });

  it("lets the owner or a tools.use admin read a job, but not another member", async () => {
    const store = openMemoryTenant();
    const owner = adminActor({ id: "usr_owner" });
    const started = await startSlideExportJob(store, owner, exportInput(), {
      workflow: silentWorkflow(),
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }

    const asOwner = await getSlideExportJobStatus(store, owner, started.jobId);
    expect(asOwner.ok).toBe(true);

    const asAdmin = await getSlideExportJobStatus(
      store,
      adminActor({ id: "usr_other_admin" }),
      started.jobId,
    );
    expect(asAdmin.ok).toBe(true);

    const asMember = await getSlideExportJobStatus(store, memberActor(), started.jobId);
    expect(asMember.ok).toBe(false);
    if (!asMember.ok) {
      expect(asMember.error.status).toBe(403);
    }

    const missing = await getSlideExportJobStatus(store, owner, "job_missing");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.status).toBe(404);
    }
  });

  it("short-circuits a single cached pair and skips when forced or batched", async () => {
    const store = openMemoryTenant();
    const cache: SlideRenderCache = {
      getFresh: (lookup) =>
        Promise.resolve(
          lookup.slideId === "slide_talk"
            ? { contentHash: "hash_1", url: "https://files.test/slides/hash_1.png" }
            : null,
        ),
    };
    const resolveSpeakerName = (id: string) =>
      Promise.resolve(id === "spk_ada" ? "Ada Lovelace" : null);

    const hit = await tryShortCircuitCachedExport(store, adminActor(), exportInput(), {
      cache,
      resolveSpeakerName,
    });
    expect(hit.ok).toBe(true);
    if (!hit.ok) {
      return;
    }
    expect(hit.cached).toEqual({
      contentHash: "hash_1",
      filename: "meetup_slides_Ada_Lovelace.png",
      kind: "png",
      url: "https://files.test/slides/hash_1.png",
    });

    const labeled = await tryShortCircuitCachedExport(
      store,
      adminActor(),
      exportInput({ disambiguateFilenames: true }),
      { cache, resolveSpeakerName },
    );
    expect(labeled.ok).toBe(true);
    if (!labeled.ok) {
      return;
    }
    expect(labeled.cached?.filename).toBe("meetup_slides_Ada_Lovelace_slide_talk.png");

    const forced = await tryShortCircuitCachedExport(
      store,
      adminActor(),
      exportInput({ force: true }),
      { cache, resolveSpeakerName },
    );
    expect(forced.ok).toBe(true);
    if (!forced.ok) {
      return;
    }
    expect(forced.cached).toBeNull();

    const batched = await tryShortCircuitCachedExport(
      store,
      adminActor(),
      exportInput({ speakerIds: ["spk_ada", "spk_grace"] }),
      { cache, resolveSpeakerName },
    );
    expect(batched.ok).toBe(true);
    if (!batched.ok) {
      return;
    }
    expect(batched.cached).toBeNull();
  });

  it("declines the cache short-circuit when lookup throws, and keeps a hit if speaker lookup fails", async () => {
    const store = openMemoryTenant();
    const throwingCache: SlideRenderCache = {
      getFresh: () => Promise.reject(new Error("r2 down")),
    };
    const declined = await tryShortCircuitCachedExport(store, adminActor(), exportInput(), {
      cache: throwingCache,
    });
    expect(declined.ok).toBe(true);
    if (declined.ok) {
      expect(declined.cached).toBeNull();
    }

    const cache: SlideRenderCache = {
      getFresh: () =>
        Promise.resolve({ contentHash: "hash_1", url: "https://files.test/slides/hash_1.png" }),
    };
    const hit = await tryShortCircuitCachedExport(store, adminActor(), exportInput(), {
      cache,
      resolveSpeakerName: () => Promise.reject(new Error("speaker missing")),
    });
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.cached).toEqual({
        contentHash: "hash_1",
        filename: "meetup_slides.png",
        kind: "png",
        url: "https://files.test/slides/hash_1.png",
      });
    }
  });

  it("probes a stale queued job and persists a terminal workflow failure", async () => {
    const store = openMemoryTenant();
    const started = await startSlideExportJob(store, adminActor(), exportInput(), {
      workflow: silentWorkflow(),
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }

    const probed = await getSlideExportJobStatus(store, adminActor(), started.jobId, {
      now: new Date(Date.now() + 31_000),
      workflow: {
        create: () => Promise.resolve(),
        getInstanceStatus: () =>
          Promise.resolve({ errorMessage: "canceled by platform", status: "complete" }),
      },
    });
    expect(probed.ok).toBe(true);
    if (!probed.ok) {
      return;
    }
    expect(probed.job.status).toBe("failed");
    expect(probed.job.errorMessage).toBe("canceled by platform");

    const again = await getSlideExportJobStatus(store, adminActor(), started.jobId);
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.job.status).toBe("failed");
  });
});
