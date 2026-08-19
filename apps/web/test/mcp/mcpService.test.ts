import { describe, expect, it } from "vitest";
import { createPost, createSpace } from "@/modules/community/services/communityService";
import { createCourse } from "@/modules/courses/services/coursesService";
import { createEvent } from "@/modules/events/services/eventsService";
import { insertMembership, insertUser } from "@/modules/identity/repositories/directoryRepository";
import { createContentPage } from "@/modules/pages/services/pagesService";
import {
  connectAccount,
  createPost as createSocialPost,
} from "@/modules/social/services/socialService";
import {
  callMcpTool,
  implementedMcpToolNames,
  listMcpTools,
} from "@/modules/system/services/mcpService";
import type { McpDispatchContext } from "@/modules/system/types";
import { createSpeaker, createTalkSubmission } from "@/modules/talks/services/talksService";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { TenantStore } from "@/shared/db/tenantStore";
import { openMemoryRegistry } from "../helpers/registry";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

const START = "2026-09-01T09:00:00.000Z";
const CITY = "sydney";

/** Live catalog from src/lib/mcp/tools.ts plus health and page wrappers. */
const LIVE_TOOL_NAMES = [
  "getFeed",
  "getPost",
  "getEvents",
  "getEvent",
  "getCourses",
  "getSpaces",
  "getUserProfile",
  "getScheduledCourses",
  "requestImageUploadUrl",
  "createPost",
  "updatePost",
  "addComment",
  "updateComment",
  "deleteComment",
  "likePost",
  "bookmarkPost",
  "reactToPost",
  "reactToComment",
  "deletePost",
  "createEvent",
  "updateEvent",
  "setEventActiveState",
  "deleteEvent",
  "listSpeakerSubmissions",
  "updateSpeakerSubmissionStatus",
  "deleteSpeakerSubmission",
  "listEventSpeakers",
  "addEventSpeaker",
  "addEventSpeakerFromSubmission",
  "updateEventSpeaker",
  "deleteEventSpeaker",
  "reorderEventSpeakers",
  "getSlideGeneratorState",
  "putSlideGeneratorState",
  "listSlideStylePresets",
  "getSlideStylePreset",
  "createSlideStylePreset",
  "updateSlideStylePreset",
  "deleteSlideStylePreset",
  "createCourse",
  "updateCourse",
  "deleteCourse",
  "createScheduledCourse",
  "updateScheduledCourse",
  "deleteScheduledCourse",
  "listUsers",
  "listSocialAccounts",
  "listSocialPosts",
  "createSocialPost",
  "updateSocialPost",
  "publishSocialPost",
  "deleteSocialPost",
] as const;

function dispatchCtx(
  store: TenantStore,
  actor = adminActor(),
  extras: { registry?: RegistryStore; upload?: McpDispatchContext["upload"] } = {},
): McpDispatchContext {
  const { registry } = extras;
  return {
    actor,
    openRegistry: registry ? () => registry : undefined,
    openTenant: () => store,
    upload: extras.upload,
  };
}

interface Named {
  name: string;
}

interface Titled {
  id: string;
  title: string;
}

interface Slugged {
  slug: string;
}

describe("listMcpTools", () => {
  it("lists the complete live catalog plus health and page tools", () => {
    const tools = listMcpTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([...LIVE_TOOL_NAMES, "health", "get_page", "list_pages"]),
    );
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
    expect(implementedMcpToolNames()).toEqual([...names].sort());
  });
});

describe("callMcpTool", () => {
  it("returns the community feed for a city", async () => {
    const store = openMemoryTenant();
    const space = await createSpace(store, adminActor(), { name: "General", slug: "general" });
    expect(space.ok).toBe(true);
    if (!space.ok) {
      return;
    }
    const posted = await createPost(store, adminActor(), {
      content: "Hello feed",
      spaceId: space.space.id,
    });
    expect(posted.ok).toBe(true);

    const feed = await callMcpTool<{ posts: { content: string }[] }>(
      "getFeed",
      { citySlug: CITY },
      dispatchCtx(store),
    );
    expect(feed.ok).toBe(true);
    if (!feed.ok) {
      return;
    }
    expect(feed.posts.map((post) => post.content)).toContain("Hello feed");
  });

  it("returns platform health without opening a tenant", async () => {
    const result = await callMcpTool<{ region: string; service: string }>(
      "health",
      {},
      dispatchCtx(openMemoryTenant()),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.service).toBe("@claudecommunities/web");
    expect(result.region).toBe("au");
  });

  it("creates an event and lists or fetches it", async () => {
    const store = openMemoryTenant();
    const ctx = dispatchCtx(store);

    const created = await callMcpTool<{ event: Titled }>(
      "createEvent",
      { citySlug: CITY, isActive: true, startTime: START, title: "Intro Night" },
      ctx,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.event.title).toBe("Intro Night");

    const listed = await callMcpTool<{ events: Titled[] }>("getEvents", { citySlug: CITY }, ctx);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.events.map((event) => event.title)).toContain("Intro Night");

    const fetched = await callMcpTool<{ event: Titled }>(
      "getEvent",
      { citySlug: CITY, eventId: created.event.id },
      ctx,
    );
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.event.id).toBe(created.event.id);
  });

  it("lists community posts, courses, talks, speakers, pages, social posts, and slides", async () => {
    const store = openMemoryTenant();
    const ctx = dispatchCtx(store);
    const args = { citySlug: CITY };

    const space = await createSpace(store, adminActor(), { name: "General" });
    expect(space.ok).toBe(true);
    if (!space.ok) {
      return;
    }
    const post = await createPost(store, memberActor(), {
      content: "Hello city",
      spaceId: space.space.id,
      title: "Intro",
    });
    expect(post.ok).toBe(true);

    const feed = await callMcpTool<{ posts: { title: string | null }[] }>("getFeed", args, ctx);
    expect(feed.ok).toBe(true);
    if (!feed.ok) {
      return;
    }
    expect(feed.posts).toHaveLength(1);
    expect(feed.posts[0]?.title).toBe("Intro");

    const course = await createCourse(store, adminActor(), {
      isPublished: true,
      slug: "intro",
      title: "Intro to Claude",
    });
    expect(course.ok).toBe(true);

    const courses = await callMcpTool<{ courses: Slugged[] }>("getCourses", args, ctx);
    expect(courses.ok).toBe(true);
    if (!courses.ok) {
      return;
    }
    expect(courses.courses.map((item) => item.slug)).toEqual(["intro"]);

    const talk = await createTalkSubmission(store, memberActor(), {
      email: "ada@example.com",
      name: "Ada",
      title: "Building with Claude",
    });
    expect(talk.ok).toBe(true);

    const talks = await callMcpTool<{ talks: unknown[] }>("listSpeakerSubmissions", args, ctx);
    expect(talks.ok).toBe(true);
    if (!talks.ok) {
      return;
    }
    expect(talks.talks).toHaveLength(1);

    const event = await createEvent(store, adminActor(), {
      location: "Sydney",
      startTime: START,
      title: "Meetup Night",
    });
    expect(event.ok).toBe(true);
    if (!event.ok) {
      return;
    }
    const speaker = await createSpeaker(store, adminActor(), event.event.id, { name: "Ada" });
    expect(speaker.ok).toBe(true);

    const speakers = await callMcpTool<{ speakers: Named[] }>(
      "listEventSpeakers",
      { citySlug: CITY, eventId: event.event.id },
      ctx,
    );
    expect(speakers.ok).toBe(true);
    if (!speakers.ok) {
      return;
    }
    expect(speakers.speakers.map((item) => item.name)).toEqual(["Ada"]);

    const page = await createContentPage(store, adminActor(), {
      blocks: [{ body: "Welcome", enabled: true, heading: null, id: "blk_1", type: "richText" }],
      slug: "about",
      status: "published",
      title: "About us",
    });
    expect(page.ok).toBe(true);

    const pages = await callMcpTool<{ pages: Slugged[] }>("list_pages", args, ctx);
    expect(pages.ok).toBe(true);
    if (!pages.ok) {
      return;
    }
    expect(pages.pages.map((item) => item.slug)).toEqual(["about"]);

    const published = await callMcpTool<{ page: { title: string } | null }>(
      "get_page",
      { citySlug: CITY, slug: "about" },
      ctx,
    );
    expect(published.ok).toBe(true);
    if (!published.ok) {
      return;
    }
    expect(published.page?.title).toBe("About us");

    const account = await connectAccount(store, adminActor(), {
      connector: "zernio",
      displayName: "Claude AU",
      externalId: "org_li",
      platform: "linkedin",
    });
    expect(account.ok).toBe(true);
    if (!account.ok) {
      return;
    }
    const social = await createSocialPost(store, adminActor(), {
      accountId: account.account.id,
      content: "Ship it",
    });
    expect(social.ok).toBe(true);

    const socialPosts = await callMcpTool<{ posts: unknown[] }>("listSocialPosts", args, ctx);
    expect(socialPosts.ok).toBe(true);
    if (!socialPosts.ok) {
      return;
    }
    expect(socialPosts.posts).toHaveLength(1);

    const state = await callMcpTool<{ state: { scope: string } }>(
      "getSlideGeneratorState",
      { citySlug: CITY, scope: "global" },
      ctx,
    );
    expect(state.ok).toBe(true);
    if (!state.ok) {
      return;
    }
    expect(state.state.scope).toBe("global");

    const presets = await callMcpTool<{ presets: unknown[] }>("listSlideStylePresets", args, ctx);
    expect(presets.ok).toBe(true);
    if (!presets.ok) {
      return;
    }
    expect(presets.presets).toEqual([]);
  });

  it("lists org members and returns the actor profile from the registry", async () => {
    const tenant = openMemoryTenant();
    const registry = openMemoryRegistry();
    const actor = adminActor({ id: "usr_ada" });
    await insertUser(registry, {
      clerkUserId: "clk_ada",
      displayName: "Ada",
      email: "ada@example.com",
      id: actor.id,
    });
    await insertMembership(registry, { orgId: tenant.orgId, role: "admin", userId: actor.id });
    const ctx = dispatchCtx(tenant, actor, { registry });

    const listed = await callMcpTool<{ users: { email: string }[] }>(
      "listUsers",
      { citySlug: CITY },
      ctx,
    );
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.users.map((user) => user.email)).toEqual(["ada@example.com"]);

    const profile = await callMcpTool<{ user: { displayName: string | null; id: string } }>(
      "getUserProfile",
      {},
      ctx,
    );
    expect(profile.ok).toBe(true);
    if (!profile.ok) {
      return;
    }
    expect(profile.user.id).toBe(actor.id);
    expect(profile.user.displayName).toBe("Ada");
  });

  it("returns MCP upload credentials from the injected upload port", async () => {
    const result = await callMcpTool<{ curl_command: string; upload_url: string }>(
      "requestImageUploadUrl",
      { folder: "events" },
      dispatchCtx(openMemoryTenant(), adminActor(), {
        upload: { baseUrl: "https://example.test", token: "tok_mcp" },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.upload_url).toBe("https://example.test/api/upload/mcp");
    expect(result.curl_command).toContain("folder=events");
  });

  it("returns 503 for requestImageUploadUrl when upload is not configured", async () => {
    const result = await callMcpTool("requestImageUploadUrl", {}, dispatchCtx(openMemoryTenant()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(503);
    }
  });

  it("rejects publishSocialPost without social.publish", async () => {
    const store = openMemoryTenant();
    const result = await callMcpTool(
      "publishSocialPost",
      { citySlug: CITY, postId: "post_1" },
      dispatchCtx(store, memberActor()),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(403);
    }
  });

  it("returns not_found for an unknown tool name", async () => {
    const result = await callMcpTool("not_a_real_tool", {}, dispatchCtx(openMemoryTenant()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(404);
    }
  });
});
