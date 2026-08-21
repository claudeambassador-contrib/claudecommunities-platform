import { describe, expect, it } from "vitest";

import { getEvent } from "@/modules/events/services/eventsService";
import { callMcpTool } from "@/modules/system/services/mcpService";
import type { McpDispatchContext } from "@/modules/system/types";

import { adminActor, openMemoryTenant } from "../helpers/tenant";

const START = "2026-09-01T09:00:00.000Z";
const COVER = "https://images.lumacdn.com/cover.png";

describe("MCP events contract", () => {
  it("keeps speaking imageUrl while the module stores coverUrl", async () => {
    const store = openMemoryTenant();
    const ctx: McpDispatchContext = { actor: adminActor(), openTenant: () => store };

    const created = await callMcpTool<{ event: { id: string; imageUrl: string | null } }>(
      "createEvent",
      { citySlug: "sydney", imageUrl: COVER, isActive: true, startTime: START, title: "MCP night" },
      ctx,
    );
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    // Wire name stays `imageUrl` for MCP clients…
    expect(created.event.imageUrl).toBe(COVER);
    expect(created.event).not.toHaveProperty("coverUrl");

    // …while the module's canonical name is `coverUrl`.
    const stored = await getEvent(store, created.event.id);
    expect(stored.ok).toBeTruthy();
    if (!stored.ok) {
      return;
    }
    expect(stored.event.coverUrl).toBe(COVER);

    const listed = await callMcpTool<{ events: { imageUrl: string | null }[] }>(
      "getEvents",
      { citySlug: "sydney" },
      ctx,
    );
    expect(listed.ok).toBeTruthy();
    if (!listed.ok) {
      return;
    }
    expect(listed.events.map((event) => event.imageUrl)).toStrictEqual([COVER]);
  });

  it("rejects a disallowed image host sent as imageUrl", async () => {
    const store = openMemoryTenant();
    const ctx: McpDispatchContext = { actor: adminActor(), openTenant: () => store };

    const created = await callMcpTool(
      "createEvent",
      {
        citySlug: "sydney",
        imageUrl: "https://evil.example/cover.png",
        startTime: START,
        title: "Bad cover",
      },
      ctx,
    );
    expect(created.ok).toBeFalsy();
    if (created.ok) {
      return;
    }
    expect(created.error.status).toBe(400);
  });
});
