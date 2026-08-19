import {
  createComment as createCommentService,
  createPost as createCommunityPost,
  deleteComment as deleteCommentService,
  deletePost as deleteCommunityPost,
  getPost as getPostService,
  listComments,
  listFeed,
  listSpaces,
  toggleCommentReaction,
  togglePostBookmark,
  togglePostLike,
  togglePostReaction,
  updateComment as updateCommentService,
  updatePost as updateCommunityPost,
} from "@/modules/community/services/communityService";
import {
  createCourse as createCourseService,
  createScheduledCourse,
  listPublished,
  listPublishedScheduled,
  removeCourse,
  removeScheduledCourse,
  updateCourse as updateCourseService,
  updateScheduledCourse,
} from "@/modules/courses/services/coursesService";
import {
  createEvent as createEventService,
  deleteEvent as deleteEventService,
  getEvent as getEventService,
  listEvents as listEventsService,
  setEventActive,
  updateEvent as updateEventService,
} from "@/modules/events/services/eventsService";
import type { EventCreateBody, EventUpdateBody } from "@/modules/events/types";
import {
  getOwnProfile,
  listUsers as listUsersService,
} from "@/modules/identity/services/usersService";
import { getPublishedPage, listContentPages } from "@/modules/pages/services/pagesService";
import {
  createPreset,
  deletePreset,
  getPreset,
  getState,
  listPresets,
  putState,
  updatePreset,
} from "@/modules/slides/services/slideGeneratorService";
import {
  createPost as createSocialPostService,
  deletePost as deleteSocialPostService,
  listAccounts,
  listPosts as listSocialPostsService,
  publishExisting,
  updatePost as updateSocialPostService,
} from "@/modules/social/services/socialService";
import type {
  SocialPostInput,
  SocialPostListOptions,
  SocialPostUpdate,
} from "@/modules/social/types";
import { bool, num, requireStr, str, strOrNull, strs } from "@/modules/system/mcpArgs";
import { MCP_CATALOG } from "@/modules/system/mcpCatalog";
import { healthService } from "@/modules/system/services/healthService";
import { requestImageUploadUrl } from "@/modules/system/services/uploadService";
import type { McpArgs, McpDispatchContext, McpToolInfo } from "@/modules/system/types";
import {
  createSpeaker,
  createSpeakerFromSubmission,
  deleteSpeaker,
  deleteTalkSubmission,
  listSpeakers,
  listTalkSubmissions,
  reorderSpeakers,
  setTalkStatus,
  updateSpeaker,
} from "@/modules/talks/services/talksService";
import type { SpeakerInput, TalkSubmissionStatus } from "@/modules/talks/types";
import { ensurePermission } from "@/shared/auth/actor";
import { hasPermission } from "@/shared/auth/permissions";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

type Handler = (args: McpArgs, ctx: McpDispatchContext) => Promise<Result<object>> | Result<object>;

const TALK_STATUSES = new Set<TalkSubmissionStatus>(["pending", "approved", "declined"]);

async function openStore(
  args: McpArgs,
  ctx: McpDispatchContext,
): Promise<Result<{ store: TenantStore }>> {
  const citySlug = str(args, "citySlug");
  if (!citySlug) {
    return err("bad_request", 400, "citySlug is required");
  }
  return ok({ store: await ctx.openTenant(citySlug) });
}

async function openRegistry(ctx: McpDispatchContext): Promise<Result<{ registry: RegistryStore }>> {
  if (!ctx.openRegistry) {
    return err("unavailable", 503, "Registry is not configured");
  }
  return ok({ registry: await ctx.openRegistry() });
}

function eventBody(args: McpArgs): EventCreateBody | EventUpdateBody {
  return {
    city: str(args, "city"),
    description: str(args, "description"),
    endTime: str(args, "endTime"),
    eventType: str(args, "eventType"),
    feedbackUrl: str(args, "feedbackUrl"),
    footerText: str(args, "footerText"),
    headerText: str(args, "headerText"),
    imageUrl: str(args, "imageUrl"),
    isActive: bool(args, "isActive"),
    isOnline: bool(args, "isOnline"),
    location: str(args, "location"),
    lumaUrl: str(args, "lumaUrl"),
    maxAttendees: num(args, "maxAttendees"),
    meetingUrl: str(args, "meetingUrl"),
    rsvpEnabled: bool(args, "rsvpEnabled"),
    startTime: str(args, "startTime"),
    timezone: str(args, "timezone"),
    title: str(args, "title"),
  };
}

function speakerBody(args: McpArgs): SpeakerInput {
  return {
    bio: str(args, "bio"),
    company: str(args, "company"),
    companyLogoUrl: str(args, "companyLogoUrl"),
    headshotUrl: str(args, "headshotUrl"),
    linkedinUrl: str(args, "linkedinUrl"),
    name: str(args, "name"),
    talkDescription: str(args, "talkDescription"),
    talkDescriptionShort: str(args, "talkDescriptionShort"),
    talkTitle: str(args, "talkTitle"),
    title: str(args, "title"),
    twitterHandle: str(args, "twitterHandle"),
    websiteUrl: str(args, "websiteUrl"),
  };
}

const HANDLERS: Record<string, Handler> = {
  async addComment(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    const content = requireStr(args, "content");
    if (!content.ok) {
      return content;
    }
    return createCommentService(opened.store, ctx.actor, {
      content: content.value,
      parentId: str(args, "parentId"),
      postId: postId.value,
    });
  },

  async addEventSpeaker(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    return createSpeaker(opened.store, ctx.actor, eventId.value, speakerBody(args));
  },

  async addEventSpeakerFromSubmission(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    const submissionId = requireStr(args, "submissionId");
    if (!submissionId.ok) {
      return submissionId;
    }
    return createSpeakerFromSubmission(opened.store, ctx.actor, eventId.value, submissionId.value);
  },

  async bookmarkPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    return togglePostBookmark(opened.store, ctx.actor, postId.value);
  },

  async createCourse(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const title = requireStr(args, "title");
    if (!title.ok) {
      return title;
    }
    const slug = requireStr(args, "slug");
    if (!slug.ok) {
      return slug;
    }
    return createCourseService(opened.store, ctx.actor, {
      description: str(args, "description"),
      isPublished: bool(args, "isPublished"),
      slug: slug.value,
      title: title.value,
    });
  },

  async createEvent(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const title = requireStr(args, "title");
    if (!title.ok) {
      return title;
    }
    const startTime = requireStr(args, "startTime");
    if (!startTime.ok) {
      return startTime;
    }
    return createEventService(opened.store, ctx.actor, {
      ...eventBody(args),
      isActive: bool(args, "isActive") ?? false,
      startTime: startTime.value,
      title: title.value,
    });
  },

  async createPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const content = requireStr(args, "content");
    if (!content.ok) {
      return content;
    }
    const spaceId = requireStr(args, "spaceId");
    if (!spaceId.ok) {
      return spaceId;
    }
    const imageUrl = str(args, "imageUrl");
    return createCommunityPost(opened.store, ctx.actor, {
      content: content.value,
      mediaType: imageUrl ? "image" : undefined,
      mediaUrl: imageUrl,
      spaceId: spaceId.value,
      title: str(args, "title"),
    });
  },

  async createScheduledCourse(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const title = requireStr(args, "title");
    if (!title.ok) {
      return title;
    }
    const startTime = requireStr(args, "startTime");
    if (!startTime.ok) {
      return startTime;
    }
    return createScheduledCourse(opened.store, ctx.actor, {
      city: str(args, "city"),
      courseType: str(args, "courseType"),
      description: str(args, "description"),
      imageUrl: str(args, "imageUrl"),
      instructor: str(args, "instructor"),
      isOnline: bool(args, "isOnline"),
      isPublished: bool(args, "isPublished"),
      location: str(args, "location"),
      maxAttendees: num(args, "maxAttendees"),
      meetingUrl: str(args, "meetingUrl"),
      price: str(args, "price"),
      registrationUrl: str(args, "registrationUrl"),
      startTime: startTime.value,
      title: title.value,
    });
  },

  async createSlideStylePreset(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const name = requireStr(args, "name");
    if (!name.ok) {
      return name;
    }
    return createPreset(opened.store, ctx.actor, { data: args.data, name: name.value });
  },

  async createSocialPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const accountId = requireStr(args, "accountId");
    if (!accountId.ok) {
      return accountId;
    }
    const content = requireStr(args, "content");
    if (!content.ok) {
      return content;
    }
    const input: SocialPostInput = {
      accountId: accountId.value,
      content: content.value,
      mediaUrls: strs(args, "mediaUrls"),
      scheduledAt: str(args, "scheduledAt"),
    };
    const action = str(args, "action");
    if (action === "draft" || action === "scheduled" || action === "publish") {
      input.action = action;
    }
    const mediaType = str(args, "mediaType");
    if (
      mediaType === "none" ||
      mediaType === "image" ||
      mediaType === "multi_image" ||
      mediaType === "video" ||
      mediaType === "document"
    ) {
      input.mediaType = mediaType;
    }
    return createSocialPostService(opened.store, ctx.actor, input);
  },

  async deleteComment(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const commentId = requireStr(args, "commentId");
    if (!commentId.ok) {
      return commentId;
    }
    return deleteCommentService(opened.store, ctx.actor, commentId.value);
  },

  async deleteCourse(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const courseId = requireStr(args, "courseId");
    if (!courseId.ok) {
      return courseId;
    }
    return removeCourse(opened.store, ctx.actor, courseId.value);
  },

  async deleteEvent(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    return deleteEventService(opened.store, ctx.actor, eventId.value);
  },

  async deleteEventSpeaker(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const speakerId = requireStr(args, "speakerId");
    if (!speakerId.ok) {
      return speakerId;
    }
    return deleteSpeaker(opened.store, ctx.actor, speakerId.value);
  },

  async deletePost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    return deleteCommunityPost(opened.store, ctx.actor, postId.value);
  },

  async deleteScheduledCourse(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const courseId = requireStr(args, "courseId");
    if (!courseId.ok) {
      return courseId;
    }
    return removeScheduledCourse(opened.store, ctx.actor, courseId.value);
  },

  async deleteSlideStylePreset(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const presetId = requireStr(args, "presetId");
    if (!presetId.ok) {
      return presetId;
    }
    return deletePreset(opened.store, ctx.actor, presetId.value);
  },

  async deleteSocialPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    return deleteSocialPostService(opened.store, ctx.actor, postId.value);
  },

  async deleteSpeakerSubmission(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const submissionId = requireStr(args, "submissionId");
    if (!submissionId.ok) {
      return submissionId;
    }
    return deleteTalkSubmission(opened.store, ctx.actor, submissionId.value);
  },

  async get_page(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const slug = requireStr(args, "slug");
    if (!slug.ok) {
      return slug;
    }
    return getPublishedPage(opened.store, slug.value);
  },

  async getCourses(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listPublished(opened.store);
  },

  async getEvent(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    return getEventService(opened.store, eventId.value, {
      includeInactive: hasPermission(ctx.actor.permissions, "events.view"),
    });
  },

  async getEvents(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const listed = await listEventsService(opened.store, {
      includeInactive: hasPermission(ctx.actor.permissions, "events.view"),
    });
    if (!listed.ok) {
      return listed;
    }
    if (!bool(args, "upcoming")) {
      return listed;
    }
    const now = Date.now();
    return ok({
      events: listed.events.filter(
        (event) => event.startTime !== null && new Date(event.startTime).getTime() >= now,
      ),
    });
  },

  async getFeed(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listFeed(opened.store, { spaceSlug: str(args, "spaceSlug"), viewer: ctx.actor });
  },

  async getPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    const post = await getPostService(opened.store, postId.value, ctx.actor);
    if (!post.ok) {
      return post;
    }
    const comments = await listComments(opened.store, postId.value);
    if (!comments.ok) {
      return comments;
    }
    return ok({ comments: comments.comments, post: post.post });
  },

  async getScheduledCourses(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listPublishedScheduled(opened.store, { upcoming: bool(args, "upcoming") });
  },

  async getSlideGeneratorState(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const scope = requireStr(args, "scope");
    if (!scope.ok) {
      return scope;
    }
    return getState(opened.store, ctx.actor, scope.value);
  },

  async getSlideStylePreset(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const presetId = requireStr(args, "presetId");
    if (!presetId.ok) {
      return presetId;
    }
    return getPreset(opened.store, ctx.actor, presetId.value);
  },

  async getSpaces(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listSpaces(opened.store);
  },

  async getUserProfile(_args, ctx) {
    const registry = await openRegistry(ctx);
    if (!registry.ok) {
      return registry;
    }
    return getOwnProfile(registry.registry, ctx.actor);
  },
  health() {
    const snapshot = healthService();
    return ok({
      region: snapshot.region,
      service: snapshot.service,
      siteName: snapshot.siteName,
      ts: snapshot.ts,
    });
  },

  async likePost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    return togglePostLike(opened.store, ctx.actor, postId.value);
  },

  async list_pages(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listContentPages(opened.store, ctx.actor);
  },

  async listEventSpeakers(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    return listSpeakers(opened.store, ctx.actor, eventId.value);
  },

  async listSlideStylePresets(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listPresets(opened.store, ctx.actor);
  },

  async listSocialAccounts(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    return listAccounts(opened.store, ctx.actor);
  },

  async listSocialPosts(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const range = str(args, "range");
    const platform = str(args, "platform");
    const options: SocialPostListOptions = {
      accountId: str(args, "accountId"),
      limit: num(args, "limit"),
    };
    if (range === "past" || range === "upcoming" || range === "all") {
      options.range = range;
    }
    if (platform === "linkedin") {
      options.platform = platform;
    }
    return listSocialPostsService(opened.store, ctx.actor, options);
  },

  async listSpeakerSubmissions(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const status = str(args, "status");
    if (status && !TALK_STATUSES.has(status as TalkSubmissionStatus)) {
      return err("bad_request", 400, "status must be pending, approved, or declined");
    }
    return listTalkSubmissions(opened.store, ctx.actor, {
      status: status as TalkSubmissionStatus | undefined,
    });
  },

  async listUsers(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const registry = await openRegistry(ctx);
    if (!registry.ok) {
      return registry;
    }
    return listUsersService(registry.registry, ctx.actor, opened.store.orgId, {
      limit: num(args, "limit"),
      offset: num(args, "offset"),
      search: str(args, "search"),
    });
  },

  async publishSocialPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    const allowed = ensurePermission(ctx.actor, "social.publish");
    if (!allowed.ok) {
      return allowed;
    }
    return publishExisting(opened.store, postId.value);
  },

  async putSlideGeneratorState(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const scope = requireStr(args, "scope");
    if (!scope.ok) {
      return scope;
    }
    return putState(opened.store, ctx.actor, scope.value, args.data);
  },

  async reactToComment(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const commentId = requireStr(args, "commentId");
    if (!commentId.ok) {
      return commentId;
    }
    const emoji = requireStr(args, "emoji");
    if (!emoji.ok) {
      return emoji;
    }
    return toggleCommentReaction(opened.store, ctx.actor, commentId.value, emoji.value);
  },

  async reactToPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    const emoji = requireStr(args, "emoji");
    if (!emoji.ok) {
      return emoji;
    }
    return togglePostReaction(opened.store, ctx.actor, postId.value, emoji.value);
  },

  async reorderEventSpeakers(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    const speakerIds = strs(args, "speakerIds");
    if (!speakerIds) {
      return err("bad_request", 400, "speakerIds is required");
    }
    return reorderSpeakers(opened.store, ctx.actor, eventId.value, speakerIds);
  },

  requestImageUploadUrl(args, ctx) {
    if (!ctx.upload) {
      return err("unavailable", 503, "Upload is not configured");
    }
    const result = requestImageUploadUrl(ctx.upload, { folder: str(args, "folder") });
    if (!result.ok) {
      return result;
    }
    return ok({
      curl_command: result.curlCommand,
      note: result.note,
      upload_url: result.uploadUrl,
    });
  },

  async setEventActiveState(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    const isActive = bool(args, "isActive");
    if (isActive === undefined) {
      return err("bad_request", 400, "isActive is required");
    }
    return setEventActive(opened.store, ctx.actor, eventId.value, isActive);
  },

  async updateComment(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const commentId = requireStr(args, "commentId");
    if (!commentId.ok) {
      return commentId;
    }
    const content = requireStr(args, "content");
    if (!content.ok) {
      return content;
    }
    return updateCommentService(opened.store, ctx.actor, commentId.value, content.value);
  },

  async updateCourse(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const courseId = requireStr(args, "courseId");
    if (!courseId.ok) {
      return courseId;
    }
    return updateCourseService(opened.store, ctx.actor, courseId.value, {
      description: str(args, "description"),
      isPublished: bool(args, "isPublished"),
      slug: str(args, "slug"),
      title: str(args, "title"),
    });
  },

  async updateEvent(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const eventId = requireStr(args, "eventId");
    if (!eventId.ok) {
      return eventId;
    }
    return updateEventService(opened.store, ctx.actor, eventId.value, eventBody(args));
  },

  async updateEventSpeaker(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const speakerId = requireStr(args, "speakerId");
    if (!speakerId.ok) {
      return speakerId;
    }
    return updateSpeaker(opened.store, ctx.actor, speakerId.value, speakerBody(args));
  },

  async updatePost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    return updateCommunityPost(opened.store, ctx.actor, postId.value, {
      content: str(args, "content"),
      mediaUrl: str(args, "imageUrl"),
      removeImage: bool(args, "removeImage"),
      spaceId: str(args, "spaceId"),
      title: str(args, "title"),
    });
  },

  async updateScheduledCourse(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const courseId = requireStr(args, "courseId");
    if (!courseId.ok) {
      return courseId;
    }
    return updateScheduledCourse(opened.store, ctx.actor, courseId.value, {
      city: str(args, "city"),
      courseType: str(args, "courseType"),
      description: str(args, "description"),
      imageUrl: str(args, "imageUrl"),
      instructor: str(args, "instructor"),
      isOnline: bool(args, "isOnline"),
      isPublished: bool(args, "isPublished"),
      location: str(args, "location"),
      maxAttendees: num(args, "maxAttendees"),
      meetingUrl: str(args, "meetingUrl"),
      price: str(args, "price"),
      registrationUrl: str(args, "registrationUrl"),
      startTime: str(args, "startTime"),
      title: str(args, "title"),
    });
  },

  async updateSlideStylePreset(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const presetId = requireStr(args, "presetId");
    if (!presetId.ok) {
      return presetId;
    }
    return updatePreset(opened.store, ctx.actor, presetId.value, {
      data: args.data,
      name: str(args, "name"),
    });
  },

  async updateSocialPost(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const postId = requireStr(args, "postId");
    if (!postId.ok) {
      return postId;
    }
    const patch: SocialPostUpdate = {
      content: str(args, "content"),
      mediaUrls: strs(args, "mediaUrls"),
      scheduledAt: strOrNull(args, "scheduledAt"),
    };
    const mediaType = str(args, "mediaType");
    if (
      mediaType === "none" ||
      mediaType === "image" ||
      mediaType === "multi_image" ||
      mediaType === "video" ||
      mediaType === "document"
    ) {
      patch.mediaType = mediaType;
    }
    const status = str(args, "status");
    if (status === "draft" || status === "scheduled" || status === "cancelled") {
      patch.status = status;
    }
    return updateSocialPostService(opened.store, ctx.actor, postId.value, patch);
  },

  async updateSpeakerSubmissionStatus(args, ctx) {
    const opened = await openStore(args, ctx);
    if (!opened.ok) {
      return opened;
    }
    const submissionId = requireStr(args, "submissionId");
    if (!submissionId.ok) {
      return submissionId;
    }
    const status = str(args, "status");
    if (!(status && TALK_STATUSES.has(status as TalkSubmissionStatus))) {
      return err("bad_request", 400, "status must be pending, approved, or declined");
    }
    return setTalkStatus(
      opened.store,
      ctx.actor,
      submissionId.value,
      status as TalkSubmissionStatus,
    );
  },
};

export function listMcpTools(): McpToolInfo[] {
  return [...MCP_CATALOG];
}

export function implementedMcpToolNames(): string[] {
  return Object.keys(HANDLERS).sort();
}

export async function callMcpTool<T extends object = Record<string, unknown>>(
  name: string,
  args: McpArgs,
  ctx: McpDispatchContext,
): Promise<Result<T>> {
  if (!MCP_CATALOG.some((tool) => tool.name === name)) {
    return err("not_found", 404, `Unknown tool: ${name}`);
  }
  const handler = HANDLERS[name];
  if (!handler) {
    return err("not_implemented", 501, `Tool not implemented: ${name}`);
  }
  return (await handler(args, ctx)) as Result<T>;
}
