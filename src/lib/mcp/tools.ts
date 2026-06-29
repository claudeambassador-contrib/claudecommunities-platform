import { z } from "zod";
import { getActorPermissions, hasPermission, type Permission } from "@/lib/permissions";
import { errorResult, jsonResult, withMcpService } from "@/lib/services/_mcp";
import { togglePostBookmark } from "@/lib/services/bookmarks";
import {
  createComment as createCommentService,
  deleteComment as deleteCommentService,
  updateComment as updateCommentService,
} from "@/lib/services/comments";
import {
  create as createCourseService,
  remove as deleteCourseService,
  listPublished as listCoursesService,
  update as updateCourseService,
} from "@/lib/services/courses";
import {
  createEvent as createEventService,
  deleteEvent as deleteEventService,
  getEvent as getEventService,
  listEvents as listEventsService,
  setEventActive as setEventActiveService,
  updateEvent as updateEventService,
} from "@/lib/services/events";
import { togglePostLike } from "@/lib/services/likes";
import {
  createPost as createPostService,
  deletePost as deletePostService,
  getPost as getPostService,
  listFeed as listFeedService,
  updatePost as updatePostService,
} from "@/lib/services/posts";
import { toggleCommentReaction, togglePostReaction } from "@/lib/services/reactions";
import {
  create as createScheduledCourseService,
  remove as deleteScheduledCourseService,
  listPublished as listScheduledCoursesService,
  update as updateScheduledCourseService,
} from "@/lib/services/scheduled-courses";
import {
  createPreset as createSlidePresetService,
  deletePreset as deleteSlidePresetService,
  getPreset as getSlidePresetService,
  getState as getSlideStateService,
  listPresets as listSlidePresetsService,
  putState as putSlideStateService,
  updatePreset as updateSlidePresetService,
} from "@/lib/services/slideGenerator";
import { listAccounts as listSocialAccountsService } from "@/lib/services/socialAccounts";
import {
  createPost as createSocialPostService,
  deletePost as deleteSocialPostService,
  listPosts as listSocialPostsService,
  publishExisting as publishSocialPostService,
  updatePost as updateSocialPostService,
} from "@/lib/services/socialPosts";
import { listSpaces as listSpacesService } from "@/lib/services/spaces";
import {
  createSpeakerFromSubmission as createSpeakerFromSubmissionService,
  createSpeaker as createSpeakerService,
  deleteSpeaker as deleteSpeakerService,
  deleteSpeakerSubmission as deleteSpeakerSubmissionService,
  listSpeakerSubmissions as listSpeakerSubmissionsService,
  listSpeakers as listSpeakersService,
  reorderSpeakers as reorderSpeakersService,
  updateSpeaker as updateSpeakerService,
  updateSpeakerSubmissionStatus as updateSpeakerSubmissionStatusService,
} from "@/lib/services/speakers";
import { getUserByClerkId, listUsers as listUsersService } from "@/lib/services/users";
import { getTenantConfig } from "@/lib/tenant-config";
import { HOME_TENANT, runWithTenant } from "@/lib/tenant-context";
import { registerUiTools } from "./ui-tools";

// MCP carries no URL tenant (middleware leaves /mcp fail-closed), so the base
// URL is the home tenant's appUrl. Resolve it in its OWN HOME_TENANT scope:
// runWithTenant is nestable, so this is a no-op re-entry inside the
// withMcpService-wrapped handlers and self-sufficient in the bare-async ones —
// neither relies on the caller already being scoped. Replaces the former
// module-level `const BASE_URL = appUrl()` (now a per-tenant config read).
async function mcpBaseUrl(): Promise<string> {
  return runWithTenant(HOME_TENANT, async () => (await getTenantConfig()).appUrl);
}

// MCP AuthInfo shape from verifyClerkToken — userId is in extra.userId
interface McpAuthInfo {
  extra?: { userId?: string };
}

async function getDbUser(authInfo: unknown) {
  const auth = authInfo as McpAuthInfo;
  const clerkId = auth?.extra?.userId;
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    throw new Error("User not found. Visit the community site first to create your account.");
  }
  // Membership-based, resolved against the home-tenant scope established by
  // withMcpService (not the global user.role).
  const { permissions } = await getActorPermissions(user.id);
  return Object.assign(user, { permissions });
}

function requirePermission(user: { permissions: readonly Permission[] }, permission: Permission) {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: MCP SDK's McpServer.tool() overloads reject our withMcpService handler shapes
export function registerTools(server: any, options: { isAdmin: boolean }) {
  // In-MCP UI tools (registers its own gating for admin tools).
  registerUiTools(server, options);

  // ==========================================
  // Read Tools (all authenticated users)
  // ==========================================

  server.tool(
    "getFeed",
    "Get the community feed posts, optionally filtered by space",
    {
      spaceSlug: z.string().optional().describe("Filter by space slug"),
      limit: z.number().int().min(1).max(50).optional().describe("Number of posts (default 20)"),
      offset: z.number().int().min(0).optional().describe("Offset for pagination"),
    },
    withMcpService(
      async (
        {
          spaceSlug,
          limit = 20,
          offset = 0,
        }: { spaceSlug?: string; limit?: number; offset?: number },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        const posts = await listFeedService({ spaceSlug, limit, offset, actor: user });
        const BASE_URL = await mcpBaseUrl();
        return posts.map((p) => ({ ...p, url: `${BASE_URL}/community/posts/${p.id}` }));
      },
    ),
  );

  server.tool(
    "getPost",
    "Get a specific post with its comments",
    {
      postId: z.string().describe("The post ID"),
    },
    withMcpService(async ({ postId }: { postId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      const post = await getPostService(postId, user);
      const BASE_URL = await mcpBaseUrl();
      return { ...post, url: `${BASE_URL}/community/posts/${post.id}` };
    }),
  );

  server.tool(
    "getEvents",
    "Get community events. Admins see inactive/unlisted events too.",
    {
      upcoming: z.boolean().optional().describe("Filter to upcoming events only"),
    },
    async ({ upcoming }: { upcoming?: boolean }, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        const events = await listEventsService({
          includeInactive: hasPermission(user, "events.view"),
        });
        const filtered = upcoming
          ? events.filter((e) => new Date(e.startTime) >= new Date())
          : events;
        const BASE_URL = await mcpBaseUrl();
        return jsonResult(
          filtered.map((e) => ({ ...e, url: `${BASE_URL}/events/${e.slug || e.id}` })),
        );
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "getEvent",
    "Get a single event by id, including all event-preparation fields. Admins can see inactive/unlisted events.",
    {
      eventId: z.string().describe("Event ID"),
    },
    withMcpService(async ({ eventId }: { eventId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      const event = await getEventService(eventId, {
        includeInactive: hasPermission(user, "events.view"),
      });
      const BASE_URL = await mcpBaseUrl();
      return { ...event, url: `${BASE_URL}/events/${event.slug || event.id}` };
    }),
  );

  server.tool(
    "getCourses",
    "Get published courses",
    {},
    async (_: Record<string, never>, { authInfo }: { authInfo: unknown }) => {
      try {
        await getDbUser(authInfo);
        const courses = await listCoursesService();
        const BASE_URL = await mcpBaseUrl();
        return jsonResult(
          courses.map((c) => ({ ...c, url: `${BASE_URL}/community/learn/${c.slug}` })),
        );
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "getSpaces",
    "Get all community spaces with post counts",
    {},
    async (_: Record<string, never>, { authInfo }: { authInfo: unknown }) => {
      try {
        await getDbUser(authInfo);
        return jsonResult(await listSpacesService());
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "getUserProfile",
    "Get your own profile",
    {},
    async (_: Record<string, never>, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({
          id: user.id,
          url: `${BASE_URL}/community/profile/${user.id}`,
          name: user.name,
          email: user.email,
          image: user.image,
          bio: user.bio,
          tagline: user.tagline,
          location: user.location,
          website: user.website,
          twitter: user.twitter,
          linkedin: user.linkedin,
          github: user.github,
          role: user.role,
          points: user.points,
          level: user.level,
          city: user.city,
          createdAt: user.createdAt,
        });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "getScheduledCourses",
    "Get published scheduled courses (workshops, bootcamps, webinars)",
    {
      upcoming: z.boolean().optional().describe("Filter to upcoming courses only"),
    },
    async ({ upcoming }: { upcoming?: boolean }, { authInfo }: { authInfo: unknown }) => {
      try {
        await getDbUser(authInfo);
        const courses = await listScheduledCoursesService({ upcoming });
        const BASE_URL = await mcpBaseUrl();
        return jsonResult(courses.map((c) => ({ ...c, url: `${BASE_URL}/courses/${c.slug}` })));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  // ==========================================
  // Write & Admin Tools (admin only)
  // ==========================================
  if (!options.isAdmin) return;

  server.tool(
    "requestImageUploadUrl",
    [
      "Get credentials to upload an image via our API without passing base64 through the context.",
      "Use the returned curl_command with the Bash tool (replace FILE_PATH with the actual path),",
      "then pass the returned url where an imageUrl/headshotUrl/companyLogoUrl/etc. is expected.",
      "Pick a folder by use case: 'community/posts' for posts (default), 'events' for event banners,",
      "'speakers/headshots' for speaker portraits, 'speakers/logos' for company logos,",
      "'slides/extras' for slide-generator custom image elements.",
    ].join(" "),
    {
      filename: z.string().describe("Filename hint, e.g. banner.jpg"),
      folder: z
        .string()
        .optional()
        .describe(
          "Upload folder. Defaults to community/posts. Use events / speakers/headshots / speakers/logos / slides/extras for non-post uploads.",
        ),
    },
    async (
      { filename: _filename, folder }: { filename: string; folder?: string },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const token = (authInfo as { token?: string })?.token;
        if (!token) {
          return errorResult("No auth token available");
        }

        const BASE_URL = await mcpBaseUrl();
        const uploadUrl = `${BASE_URL}/api/upload/mcp`;
        const folderValue = folder || "community/posts";
        const curlCommand = [
          `curl -s -X POST "${uploadUrl}"`,
          `-H "Authorization: Bearer ${token}"`,
          `-F "file=@FILE_PATH;type=image/jpeg"`,
          `-F "folder=${folderValue}"`,
        ].join(" \\\n  ");

        return jsonResult({
          upload_url: uploadUrl,
          curl_command: curlCommand,
          note: 'Replace FILE_PATH with the actual local path to your image. The response will contain a "url" field — pass that as imageUrl to createPost or updatePost.',
        });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "createPost",
    "Create a new post in a space. Optionally attach a photo by providing a public image URL. For local files, call requestImageUploadUrl first to get an upload command.",
    {
      content: z.string().describe("Post content"),
      spaceId: z.string().describe("Space ID to post in"),
      title: z.string().optional().describe("Optional post title"),
      imageUrl: z
        .string()
        .optional()
        .describe(
          'Public image URL to attach. For local files: call requestImageUploadUrl first, run the returned curl_command with Bash to upload, then pass the "url" from that response here. Avoid passing base64 data URLs — they bloat the context.',
        ),
    },
    withMcpService(
      async (
        {
          content,
          spaceId,
          title,
          imageUrl,
        }: { content: string; spaceId: string; title?: string; imageUrl?: string },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);

        let mediaUrl: string | null = null;
        let mediaType: string | null = null;
        if (imageUrl) {
          const { mirrorPostMedia } = await import("@/lib/services/posts");
          const mirrored = await mirrorPostMedia(imageUrl);
          mediaUrl = mirrored.mediaUrl;
          mediaType = mirrored.mediaType;
        }

        const { id } = await createPostService(user, {
          content,
          spaceId,
          title,
          mediaUrl,
          mediaType,
        });

        const BASE_URL = await mcpBaseUrl();
        return { id, url: `${BASE_URL}/community/posts/${id}`, success: true };
      },
    ),
  );

  server.tool(
    "updatePost",
    "Update an existing post. Optionally attach or replace a photo by providing a public image URL. For local files, call requestImageUploadUrl first to get an upload command.",
    {
      postId: z.string().describe("The post ID to update"),
      content: z.string().optional().describe("New post content"),
      title: z.string().optional().describe("New post title"),
      spaceId: z.string().optional().describe("Move post to a different space"),
      imageUrl: z
        .string()
        .optional()
        .describe(
          'Public image URL to attach. For local files: call requestImageUploadUrl first, run the returned curl_command with Bash to upload, then pass the "url" from that response here. Avoid passing base64 data URLs — they bloat the context.',
        ),
      removeImage: z.boolean().optional().describe("Set to true to remove the existing image"),
    },
    withMcpService(
      async (
        {
          postId,
          content,
          title,
          spaceId,
          imageUrl,
          removeImage,
        }: {
          postId: string;
          content?: string;
          title?: string;
          spaceId?: string;
          imageUrl?: string;
          removeImage?: boolean;
        },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        requirePermission(user, "posts.edit");

        const result = await updatePostService(user, postId, {
          content,
          title,
          spaceId,
          imageUrl,
          removeImage,
        });

        const BASE_URL = await mcpBaseUrl();
        return { id: result.id, url: `${BASE_URL}/community/posts/${result.id}`, success: true };
      },
    ),
  );

  server.tool(
    "addComment",
    "Add a comment to a post",
    {
      postId: z.string().describe("The post ID to comment on"),
      content: z.string().describe("Comment content"),
      parentId: z.string().optional().describe("Parent comment ID for replies"),
    },
    withMcpService(
      async (
        { postId, content, parentId }: { postId: string; content: string; parentId?: string },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        const comment = await createCommentService(user, { postId, content, parentId });
        const BASE_URL = await mcpBaseUrl();
        return { id: comment.id, postUrl: `${BASE_URL}/community/posts/${postId}`, success: true };
      },
    ),
  );

  server.tool(
    "updateComment",
    "Edit a comment you own (admins can edit any comment)",
    {
      commentId: z.string().describe("The comment ID to update"),
      content: z.string().describe("New comment content"),
    },
    withMcpService(
      async ({ commentId, content }: { commentId: string; content: string }, { authInfo }) => {
        const user = await getDbUser(authInfo);
        await updateCommentService(user, commentId, { content });
        return { id: commentId, success: true };
      },
    ),
  );

  server.tool(
    "deleteComment",
    "Delete a comment you own (admins can delete any comment)",
    {
      commentId: z.string().describe("The comment ID to delete"),
    },
    withMcpService(async ({ commentId }: { commentId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      await deleteCommentService(user, commentId);
      return { success: true };
    }),
  );

  server.tool(
    "likePost",
    "Toggle like on a post",
    {
      postId: z.string().describe("The post ID to like/unlike"),
    },
    withMcpService(async ({ postId }: { postId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await togglePostLike(user, postId);
    }),
  );

  server.tool(
    "bookmarkPost",
    "Toggle bookmark on a post",
    {
      postId: z.string().describe("The post ID to bookmark/unbookmark"),
    },
    withMcpService(async ({ postId }: { postId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await togglePostBookmark(user, postId);
    }),
  );

  server.tool(
    "reactToPost",
    "Toggle an emoji reaction on a post",
    {
      postId: z.string().describe("The post ID to react to"),
      emoji: z.string().describe("Emoji character, e.g. 👍"),
    },
    withMcpService(async ({ postId, emoji }: { postId: string; emoji: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await togglePostReaction(user, postId, emoji);
    }),
  );

  server.tool(
    "reactToComment",
    "Toggle an emoji reaction on a comment",
    {
      commentId: z.string().describe("The comment ID to react to"),
      emoji: z.string().describe("Emoji character, e.g. 👍"),
    },
    withMcpService(
      async ({ commentId, emoji }: { commentId: string; emoji: string }, { authInfo }) => {
        const user = await getDbUser(authInfo);
        return await toggleCommentReaction(user, commentId, emoji);
      },
    ),
  );

  server.tool(
    "deletePost",
    "Delete a post you own (admins can delete any post)",
    {
      postId: z.string().describe("The post ID to delete"),
    },
    withMcpService(async ({ postId }: { postId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      await deletePostService(user, postId);
      return { success: true };
    }),
  );

  server.tool(
    "createEvent",
    "Create a new event (admin only). Defaults to inactive/unlisted — pass isActive: true to publish immediately. Use updateEvent or setEventActive to publish later.",
    {
      title: z.string().describe("Event title"),
      startTime: z.string().describe("Start time as ISO 8601 string"),
      endTime: z.string().optional().describe("End time as ISO 8601 string"),
      description: z.string().optional().describe("Event description (markdown)"),
      location: z.string().optional().describe("Event venue/location"),
      city: z.string().optional().describe("City (must match a known CCAU city, or 'Online')"),
      timezone: z.string().optional().describe("IANA timezone (e.g. 'Australia/Sydney')"),
      eventType: z.string().optional().describe("Event type (meetup, workshop, etc.)"),
      maxAttendees: z.number().int().positive().optional().describe("Maximum attendees"),
      isOnline: z.boolean().optional().describe("Is this an online event?"),
      meetingUrl: z
        .string()
        .optional()
        .describe(
          "Online meeting URL. Host must be in the allowlist (zoom, meet.google.com, teams, luma).",
        ),
      lumaUrl: z.string().optional().describe("External Luma event link (lu.ma / luma.com only)"),
      imageUrl: z
        .string()
        .optional()
        .describe(
          "Event image URL. Must be an R2 storage URL (call requestImageUploadUrl with folder 'events') or images.lumacdn.com.",
        ),
      rsvpEnabled: z
        .boolean()
        .optional()
        .describe("Enable internal RSVP (only when there's no lumaUrl)"),
      isActive: z
        .boolean()
        .optional()
        .describe(
          "Whether the event is publicly visible. Defaults to false (unlisted/draft) for MCP-created events.",
        ),
      headerText: z
        .string()
        .optional()
        .describe("Preparation intro paragraph (markdown) shown when generating descriptions."),
      footerText: z
        .string()
        .optional()
        .describe("Preparation footer block (markdown) shown when generating descriptions."),
      feedbackUrl: z.string().optional().describe("Post-event survey URL."),
    },
    async (
      params: {
        title: string;
        startTime: string;
        endTime?: string;
        description?: string;
        location?: string;
        city?: string;
        timezone?: string;
        eventType?: string;
        maxAttendees?: number;
        isOnline?: boolean;
        meetingUrl?: string;
        lumaUrl?: string;
        imageUrl?: string;
        rsvpEnabled?: boolean;
        isActive?: boolean;
        headerText?: string;
        footerText?: string;
        feedbackUrl?: string;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        // MCP-created events default to inactive/unlisted so admins can prep them
        // before publishing. Caller can override with isActive: true.
        const result = await createEventService(user, {
          ...params,
          isActive: params.isActive ?? false,
        });
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({ ...result, url: `${BASE_URL}/events/${result.slug}` });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "updateEvent",
    "Update an existing event (admin only). Use this to set preparation fields, attach images, or toggle activation.",
    {
      eventId: z.string().describe("Event ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description (markdown)"),
      location: z.string().optional().describe("New venue/location"),
      city: z.string().optional().describe("New city"),
      timezone: z.string().optional().describe("New IANA timezone"),
      startTime: z.string().optional().describe("New start time as ISO 8601"),
      endTime: z.string().optional().describe("New end time as ISO 8601"),
      eventType: z.string().optional().describe("New event type"),
      maxAttendees: z.number().int().positive().optional().describe("New max attendees"),
      isOnline: z.boolean().optional().describe("Is online?"),
      meetingUrl: z.string().optional().describe("New meeting URL"),
      lumaUrl: z.string().optional().describe("New Luma URL"),
      imageUrl: z
        .string()
        .optional()
        .describe(
          "New image URL (R2 storage URL or images.lumacdn.com). Upload first via requestImageUploadUrl.",
        ),
      rsvpEnabled: z.boolean().optional().describe("Enable internal RSVP"),
      isActive: z.boolean().optional().describe("Publish (true) or unlist (false)"),
      headerText: z.string().optional().describe("Preparation intro paragraph (markdown)"),
      footerText: z.string().optional().describe("Preparation footer block (markdown)"),
      feedbackUrl: z.string().optional().describe("Post-event survey URL"),
    },
    async (
      {
        eventId,
        ...updates
      }: {
        eventId: string;
        title?: string;
        description?: string;
        location?: string;
        city?: string;
        timezone?: string;
        startTime?: string;
        endTime?: string;
        eventType?: string;
        maxAttendees?: number;
        isOnline?: boolean;
        meetingUrl?: string;
        lumaUrl?: string;
        imageUrl?: string;
        rsvpEnabled?: boolean;
        isActive?: boolean;
        headerText?: string;
        footerText?: string;
        feedbackUrl?: string;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        const result = await updateEventService(user, eventId, updates);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({ ...result, url: `${BASE_URL}/events/${result.slug}` });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "setEventActiveState",
    "Set an event's active/unlisted state (admin only). Pass isActive=true to publish or false to deactivate/unlist. Equivalent to updateEvent with just { isActive }.",
    {
      eventId: z.string().describe("Event ID"),
      isActive: z.boolean().describe("true to publish, false to unlist/deactivate"),
    },
    withMcpService(
      async ({ eventId, isActive }: { eventId: string; isActive: boolean }, { authInfo }) => {
        const user = await getDbUser(authInfo);
        return await setEventActiveService(user, eventId, isActive);
      },
    ),
  );

  server.tool(
    "deleteEvent",
    "Delete an event (admin only)",
    {
      eventId: z.string().describe("Event ID to delete"),
    },
    async ({ eventId }: { eventId: string }, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        return jsonResult(await deleteEventService(user, eventId));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  // ==========================================
  // Speaker submissions + per-event speakers
  // ==========================================

  server.tool(
    "listSpeakerSubmissions",
    "List talk submissions sent via the public /speak form (admin only). Each row carries the talk title, description, optional slides (slidesUrl/slidesFileName), submitter identity, two independent lock flags (contentLocked, slidesLocked) and status. Use addEventSpeakerFromSubmission to promote one onto an event.",
    {
      status: z
        .enum(["pending", "approved", "declined"])
        .optional()
        .describe("Filter by submission status"),
    },
    withMcpService(
      async ({ status }: { status?: "pending" | "approved" | "declined" }, { authInfo }) => {
        const user = await getDbUser(authInfo);
        return await listSpeakerSubmissionsService(user, { status });
      },
    ),
  );

  server.tool(
    "updateSpeakerSubmissionStatus",
    "Set the status on a talk submission (admin only). Status: pending | approved | declined. To toggle the contentLocked / slidesLocked flags, use the admin web UI or PATCH /api/admin/speakers/{id} directly.",
    {
      submissionId: z.string().describe("Speaker submission ID"),
      status: z.enum(["pending", "approved", "declined"]).describe("New status"),
    },
    withMcpService(
      async (
        {
          submissionId,
          status,
        }: { submissionId: string; status: "pending" | "approved" | "declined" },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        return await updateSpeakerSubmissionStatusService(user, submissionId, status);
      },
    ),
  );

  server.tool(
    "deleteSpeakerSubmission",
    "Delete a talk submission (admin only). Cascades to any TalkComment rows on it. Does not remove a per-event Speaker that was promoted from it (Speaker.submissionId becomes NULL).",
    {
      submissionId: z.string().describe("Speaker submission ID"),
    },
    withMcpService(async ({ submissionId }: { submissionId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await deleteSpeakerSubmissionService(user, submissionId);
    }),
  );

  server.tool(
    "listEventSpeakers",
    "List curated speakers attached to an event, in display order (admin only). These power the slide generator and agenda.",
    {
      eventId: z.string().describe("Event ID"),
    },
    withMcpService(async ({ eventId }: { eventId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await listSpeakersService(user, eventId);
    }),
  );

  server.tool(
    "addEventSpeaker",
    "Add a speaker to an event manually (admin only). For headshotUrl / companyLogoUrl you must first upload via requestImageUploadUrl (folder: 'speakers/headshots' or 'speakers/logos') — only this app's R2 URLs are accepted.",
    {
      eventId: z.string().describe("Event ID to attach the speaker to"),
      name: z.string().describe("Speaker name"),
      title: z.string().optional().describe("Role / job title"),
      company: z.string().optional().describe("Company"),
      bio: z.string().optional().describe("Bio (markdown)"),
      talkTitle: z.string().optional().describe("Talk title"),
      talkDescription: z.string().optional().describe("Talk description (markdown)"),
      talkDescriptionShort: z
        .string()
        .optional()
        .describe(
          "Short, one-line variant of the talk description used on the speaker slide. Falls back to talkDescription when omitted.",
        ),
      headshotUrl: z
        .string()
        .optional()
        .describe("R2 storage URL of the headshot. Upload via requestImageUploadUrl first."),
      companyLogoUrl: z
        .string()
        .optional()
        .describe("R2 storage URL of the company logo. Upload via requestImageUploadUrl first."),
      twitterHandle: z.string().optional().describe("Twitter handle (without @)"),
      linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
      websiteUrl: z.string().optional().describe("Personal website URL"),
    },
    withMcpService(
      async (
        {
          eventId,
          ...input
        }: {
          eventId: string;
          name: string;
          title?: string;
          company?: string;
          bio?: string;
          talkTitle?: string;
          talkDescription?: string;
          talkDescriptionShort?: string;
          headshotUrl?: string;
          companyLogoUrl?: string;
          twitterHandle?: string;
          linkedinUrl?: string;
          websiteUrl?: string;
        },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        return await createSpeakerService(user, eventId, input);
      },
    ),
  );

  server.tool(
    "addEventSpeakerFromSubmission",
    "Promote a TalkSubmission into a curated per-event Speaker (admin only). The submission's name, bio, title→talkTitle and description→talkDescription are copied. Slides stay on the submission (admins see them via /admin/speakers and inside the event's speakers panel). Follow up with updateEventSpeaker to add headshot, company, social links, etc.",
    {
      eventId: z.string().describe("Event ID to attach the new speaker to"),
      submissionId: z.string().describe("Speaker submission ID to promote"),
    },
    withMcpService(
      async (
        { eventId, submissionId }: { eventId: string; submissionId: string },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        return await createSpeakerFromSubmissionService(user, eventId, submissionId);
      },
    ),
  );

  server.tool(
    "updateEventSpeaker",
    "Update a curated event speaker (admin only). Same URL rule as addEventSpeaker: headshotUrl / companyLogoUrl must be R2 storage URLs from requestImageUploadUrl.",
    {
      speakerId: z.string().describe("Speaker ID to update"),
      name: z.string().optional().describe("New name"),
      title: z.string().optional().describe("New role / job title"),
      company: z.string().optional().describe("New company"),
      bio: z.string().optional().describe("New bio (markdown)"),
      talkTitle: z.string().optional().describe("New talk title"),
      talkDescription: z.string().optional().describe("New talk description (markdown)"),
      talkDescriptionShort: z
        .string()
        .optional()
        .describe(
          "Short, one-line variant of the talk description used on the speaker slide (or '' to clear). Falls back to talkDescription when empty.",
        ),
      headshotUrl: z.string().optional().describe("R2 storage URL of headshot, or '' to clear"),
      companyLogoUrl: z
        .string()
        .optional()
        .describe("R2 storage URL of company logo, or '' to clear"),
      twitterHandle: z.string().optional().describe("Twitter handle"),
      linkedinUrl: z.string().optional().describe("LinkedIn URL"),
      websiteUrl: z.string().optional().describe("Website URL"),
    },
    withMcpService(
      async (
        {
          speakerId,
          ...input
        }: {
          speakerId: string;
          name?: string;
          title?: string;
          company?: string;
          bio?: string;
          talkTitle?: string;
          talkDescription?: string;
          talkDescriptionShort?: string;
          headshotUrl?: string;
          companyLogoUrl?: string;
          twitterHandle?: string;
          linkedinUrl?: string;
          websiteUrl?: string;
        },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        return await updateSpeakerService(user, speakerId, input);
      },
    ),
  );

  server.tool(
    "deleteEventSpeaker",
    "Remove a curated speaker from an event (admin only).",
    {
      speakerId: z.string().describe("Speaker ID to delete"),
    },
    withMcpService(async ({ speakerId }: { speakerId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await deleteSpeakerService(user, speakerId);
    }),
  );

  server.tool(
    "reorderEventSpeakers",
    "Set the display order of an event's speakers (admin only). Pass every existing speaker ID in the desired order.",
    {
      eventId: z.string().describe("Event ID"),
      speakerIds: z
        .array(z.string())
        .describe("Speaker IDs in display order. Must include every existing speaker."),
    },
    withMcpService(
      async ({ eventId, speakerIds }: { eventId: string; speakerIds: string[] }, { authInfo }) => {
        const user = await getDbUser(authInfo);
        return await reorderSpeakersService(user, eventId, speakerIds);
      },
    ),
  );

  // ==========================================
  // Slide generator (state + style presets)
  // ==========================================

  server.tool(
    "getSlideGeneratorState",
    [
      "Read the slide-generator working state for a scope (admin only).",
      "Scope is 'global' (the standalone admin tool) or 'event:<eventId>' (the per-event Prepare tab).",
      "Returns { scope, data, updatedAt }. `data` is the StoredStateV2 blob:",
      "  { version: 2, slides: SlideEntry[], speakers?: SlideSpeaker[], seededIds?: string[] }",
      "Each SlideEntry is { id, label, template: SlideTemplate }. SlideTemplate uses snake_case",
      "fields and contains: aspect_ratio, layout, layout_config (with elementPositions),",
      "background_*, header_*, event_date_*, name_*, title_*, description_*, headshot_*, show_*,",
      "and custom_elements (array of text/image elements for extras).",
      "For per-event scopes do NOT mutate `data.speakers` — speakers come from the Speaker table.",
      "Use this to read-modify-write: call getSlideGeneratorState, mutate the returned data,",
      "then call putSlideGeneratorState with the full updated blob.",
    ].join(" "),
    {
      scope: z
        .string()
        .describe("'global' for the standalone tool, or 'event:<eventId>' for the per-event tab."),
    },
    withMcpService(async ({ scope }: { scope: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await getSlideStateService(user, scope);
    }),
  );

  server.tool(
    "putSlideGeneratorState",
    [
      "Write the full slide-generator state for a scope (admin only).",
      "Always read first with getSlideGeneratorState, mutate locally, then send the whole",
      "updated blob here. The shape is { version: 2, slides: SlideEntry[], speakers?, seededIds? }.",
      "Element positioning: each template's layout_config.elementPositions maps element keys",
      "(header, eventDate, headshot, name, subtitle, talk, social, logo) to",
      "{ x, y, scale?, width?, height? } where x/y are percentages 0–100.",
      "To add extra text/image fields, push entries into the template's `custom_elements` array:",
      "  text: { id, type:'text', text, color, fontSize, fontFamily, fontWeight, position:{x,y} }",
      "  image: { id, type:'image', url, alt?, position:{x,y} }  (url MUST be an R2 storage URL — upload via requestImageUploadUrl, folder:'slides/extras')",
      "Colors are CSS color strings (e.g. '#ff5733'). Body is capped at 256 KB.",
    ].join(" "),
    {
      scope: z.string().describe("'global' or 'event:<eventId>' — must match the scope you read."),
      data: z
        .any()
        .describe(
          "The complete StoredStateV2 blob (see getSlideGeneratorState for shape). Round-trip after mutating.",
        ),
    },
    withMcpService(async ({ scope, data }: { scope: string; data: unknown }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await putSlideStateService(user, scope, data);
    }),
  );

  server.tool(
    "listSlideStylePresets",
    "List saved slide-generator style presets (admin only). Each preset stores a reusable SlideTemplate look that can be applied to any event.",
    {},
    withMcpService(async (_: Record<string, never>, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await listSlidePresetsService(user);
    }),
  );

  server.tool(
    "getSlideStylePreset",
    "Get one slide style preset by id (admin only).",
    {
      presetId: z.string().describe("Slide style preset ID"),
    },
    withMcpService(async ({ presetId }: { presetId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await getSlidePresetService(user, presetId);
    }),
  );

  server.tool(
    "createSlideStylePreset",
    "Save a SlideTemplate as a named, reusable style preset (admin only). Pass just the template (not the whole state blob).",
    {
      name: z.string().describe("Preset name (1–80 chars, must be unique)"),
      data: z
        .any()
        .describe(
          "A SlideTemplate object (no speakers/slides wrapper) — the snake_case template fields.",
        ),
    },
    withMcpService(async ({ name, data }: { name: string; data: unknown }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await createSlidePresetService(user, name, data);
    }),
  );

  server.tool(
    "updateSlideStylePreset",
    "Rename or update the template stored in a slide style preset (admin only).",
    {
      presetId: z.string().describe("Slide style preset ID"),
      name: z.string().optional().describe("New name (1–80 chars)"),
      data: z.any().optional().describe("New SlideTemplate object"),
    },
    withMcpService(
      async (
        { presetId, name, data }: { presetId: string; name?: string; data?: unknown },
        { authInfo },
      ) => {
        const user = await getDbUser(authInfo);
        return await updateSlidePresetService(user, presetId, { name, data });
      },
    ),
  );

  server.tool(
    "deleteSlideStylePreset",
    "Delete a slide style preset (admin only).",
    {
      presetId: z.string().describe("Slide style preset ID"),
    },
    withMcpService(async ({ presetId }: { presetId: string }, { authInfo }) => {
      const user = await getDbUser(authInfo);
      return await deleteSlidePresetService(user, presetId);
    }),
  );

  server.tool(
    "createCourse",
    "Create a new course (admin only)",
    {
      title: z.string().describe("Course title"),
      slug: z.string().describe("URL slug"),
      description: z.string().optional().describe("Course description"),
      difficulty: z
        .string()
        .optional()
        .describe("Difficulty level (beginner, intermediate, advanced)"),
      isFree: z.boolean().optional().describe("Is the course free?"),
    },
    async (
      params: {
        title: string;
        slug: string;
        description?: string;
        difficulty?: string;
        isFree?: boolean;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        const course = await createCourseService(user, params);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({
          id: course.id,
          slug: course.slug,
          title: course.title,
          url: `${BASE_URL}/community/learn/${course.slug}`,
          success: true,
        });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "updateCourse",
    "Update a course (admin only)",
    {
      courseId: z.string().describe("Course ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      difficulty: z.string().optional().describe("New difficulty"),
      isPublished: z.boolean().optional().describe("Published status"),
      isFree: z.boolean().optional().describe("Free status"),
    },
    async (
      {
        courseId,
        ...updates
      }: {
        courseId: string;
        title?: string;
        description?: string;
        difficulty?: string;
        isPublished?: boolean;
        isFree?: boolean;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        const course = await updateCourseService(user, courseId, updates);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({
          id: course.id,
          slug: course.slug,
          title: course.title,
          url: `${BASE_URL}/community/learn/${course.slug}`,
          success: true,
        });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "deleteCourse",
    "Delete a course (admin only)",
    {
      courseId: z.string().describe("Course ID to delete"),
    },
    async ({ courseId }: { courseId: string }, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        return jsonResult(await deleteCourseService(user, courseId));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "createScheduledCourse",
    "Create a new scheduled course (admin only)",
    {
      title: z.string().describe("Course title"),
      startTime: z.string().describe("Start time as ISO 8601 string"),
      description: z.string().optional().describe("Course description"),
      location: z.string().optional().describe("Course location"),
      city: z.string().optional().describe("City"),
      courseType: z
        .string()
        .optional()
        .describe("Course type (workshop, bootcamp, webinar, seminar, training)"),
      isOnline: z.boolean().optional().describe("Is this an online course?"),
      meetingUrl: z.string().optional().describe("Online meeting URL"),
      imageUrl: z.string().optional().describe("Course image URL"),
      registrationUrl: z.string().optional().describe("External registration URL"),
      price: z.string().optional().describe('Price (e.g., "$99", "Free")'),
      instructor: z.string().optional().describe("Instructor name"),
      maxAttendees: z.number().int().positive().optional().describe("Maximum attendees"),
      isPublished: z.boolean().optional().describe("Publish immediately"),
    },
    async (
      params: {
        title: string;
        startTime: string;
        description?: string;
        location?: string;
        city?: string;
        courseType?: string;
        isOnline?: boolean;
        meetingUrl?: string;
        imageUrl?: string;
        registrationUrl?: string;
        price?: string;
        instructor?: string;
        maxAttendees?: number;
        isPublished?: boolean;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        const result = await createScheduledCourseService(user, params);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({ ...result, url: `${BASE_URL}/courses/${result.slug}` });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "updateScheduledCourse",
    "Update a scheduled course (admin only)",
    {
      courseId: z.string().describe("Scheduled course ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      location: z.string().optional().describe("New location"),
      city: z.string().optional().describe("New city"),
      startTime: z.string().optional().describe("New start time as ISO 8601"),
      courseType: z.string().optional().describe("New course type"),
      isOnline: z.boolean().optional().describe("Is online?"),
      meetingUrl: z.string().optional().describe("New meeting URL"),
      imageUrl: z.string().optional().describe("New image URL"),
      registrationUrl: z.string().optional().describe("New registration URL"),
      price: z.string().optional().describe("New price"),
      instructor: z.string().optional().describe("New instructor"),
      maxAttendees: z.number().int().positive().optional().describe("New max attendees"),
      isPublished: z.boolean().optional().describe("Published status"),
    },
    async (
      {
        courseId,
        ...updates
      }: {
        courseId: string;
        title?: string;
        description?: string;
        location?: string;
        city?: string;
        startTime?: string;
        courseType?: string;
        isOnline?: boolean;
        meetingUrl?: string;
        imageUrl?: string;
        registrationUrl?: string;
        price?: string;
        instructor?: string;
        maxAttendees?: number;
        isPublished?: boolean;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        const result = await updateScheduledCourseService(user, courseId, updates);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({ ...result, url: `${BASE_URL}/courses/${result.slug}` });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "deleteScheduledCourse",
    "Delete a scheduled course (admin only)",
    {
      courseId: z.string().describe("Scheduled course ID to delete"),
    },
    async ({ courseId }: { courseId: string }, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        return jsonResult(await deleteScheduledCourseService(user, courseId));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "listUsers",
    "List community users (admin only)",
    {
      search: z.string().optional().describe("Search by name"),
      limit: z.number().int().min(1).max(100).optional().describe("Number of users (default 20)"),
      offset: z.number().int().min(0).optional().describe("Offset for pagination"),
    },
    async (
      { search, limit = 20, offset = 0 }: { search?: string; limit?: number; offset?: number },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "users.view");
        const users = await listUsersService({ search, limit, offset });
        const BASE_URL = await mcpBaseUrl();
        return jsonResult(
          users.map((u) => ({ ...u, url: `${BASE_URL}/community/profile/${u.id}` })),
        );
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  // ==========================================
  // Social posts (LinkedIn first; admin-only)
  // ==========================================

  server.tool(
    "listSocialAccounts",
    "List connected social media accounts (LinkedIn pages, etc.) the admin can post to.",
    {},
    async (_: Record<string, never>, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "social.view");
        return jsonResult(await listSocialAccountsService(user));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "listSocialPosts",
    "List social posts. Use 'range' to filter past vs upcoming. Returns scheduled, draft, published, and failed posts.",
    {
      range: z
        .enum(["past", "upcoming", "all"])
        .optional()
        .describe(
          "'past' = published/failed/cancelled; 'upcoming' = draft/scheduled/publishing; 'all' (default)",
        ),
      platform: z.enum(["linkedin"]).optional().describe("Filter by platform"),
      accountId: z.string().optional().describe("Filter to a single connected account"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50)"),
    },
    async (
      args: {
        range?: "past" | "upcoming" | "all";
        platform?: "linkedin";
        accountId?: string;
        limit?: number;
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "social.view");
        const posts = await listSocialPostsService(user, args);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult(
          posts.map((p) => ({
            ...p,
            adminUrl: `${BASE_URL}/admin/social/${p.id}`,
          })),
        );
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "createSocialPost",
    "Create a social post: save as draft, schedule, or publish now. For media: upload first via requestImageUploadUrl, then pass the returned R2 URLs in mediaUrls. mediaType controls how the platform renders them ('image', 'multi_image', 'video', 'document' for swipeable PDF carousels).",
    {
      accountId: z.string().describe("Connected SocialAccount id from listSocialAccounts"),
      content: z.string().describe("Post text/commentary"),
      mediaType: z
        .enum(["none", "image", "multi_image", "video", "document"])
        .optional()
        .describe("Default 'none'. Use 'document' for swipeable PDF carousels on LinkedIn."),
      mediaUrls: z
        .array(z.string())
        .optional()
        .describe(
          "R2 storage URLs (/api/files/<key>) returned by requestImageUploadUrl. Order matters for multi_image.",
        ),
      scheduledAt: z
        .string()
        .optional()
        .describe("ISO-8601 timestamp; required when action='scheduled'."),
      action: z
        .enum(["draft", "scheduled", "publish"])
        .optional()
        .describe(
          "'draft' (default) saves only; 'scheduled' queues for cron; 'publish' dispatches the publish workflow now (returns with status='publishing'; re-list after a few seconds to see the terminal status).",
        ),
    },
    async (
      args: {
        accountId: string;
        content: string;
        mediaType?: "none" | "image" | "multi_image" | "video" | "document";
        mediaUrls?: string[];
        scheduledAt?: string;
        action?: "draft" | "scheduled" | "publish";
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "social.edit");
        const created = await createSocialPostService(user, args);
        const BASE_URL = await mcpBaseUrl();
        return jsonResult({
          ...created,
          adminUrl: `${BASE_URL}/admin/social/${created.id}`,
        });
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "updateSocialPost",
    "Edit a draft or scheduled social post. Published posts cannot be edited.",
    {
      postId: z.string().describe("SocialPost id"),
      content: z.string().optional(),
      mediaType: z.enum(["none", "image", "multi_image", "video", "document"]).optional(),
      mediaUrls: z.array(z.string()).optional(),
      scheduledAt: z.string().nullable().optional(),
      status: z.enum(["draft", "scheduled", "cancelled"]).optional(),
    },
    async (
      {
        postId,
        ...input
      }: {
        postId: string;
        content?: string;
        mediaType?: "none" | "image" | "multi_image" | "video" | "document";
        mediaUrls?: string[];
        scheduledAt?: string | null;
        status?: "draft" | "scheduled" | "cancelled";
      },
      { authInfo }: { authInfo: unknown },
    ) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "social.edit");
        return jsonResult(await updateSocialPostService(user, postId, input));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "publishSocialPost",
    "Kick off publishing for a draft, scheduled, or previously-failed social post. The actual publish runs in a Cloudflare Workflow with checkpointed steps and automatic retries — this call returns once the workflow is dispatched (post.status='publishing'). Call listSocialPosts again after a few seconds to see the terminal status ('published' or 'failed').",
    { postId: z.string().describe("SocialPost id") },
    async ({ postId }: { postId: string }, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "social.publish");
        return jsonResult(await publishSocialPostService(postId));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );

  server.tool(
    "deleteSocialPost",
    "Delete a social post from the scheduler. Note: this only removes the row from our scheduler — already-published platform posts remain live on LinkedIn.",
    { postId: z.string().describe("SocialPost id") },
    async ({ postId }: { postId: string }, { authInfo }: { authInfo: unknown }) => {
      try {
        const user = await getDbUser(authInfo);
        requirePermission(user, "social.edit");
        return jsonResult(await deleteSocialPostService(user, postId));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : "Unknown error");
      }
    },
  );
}
