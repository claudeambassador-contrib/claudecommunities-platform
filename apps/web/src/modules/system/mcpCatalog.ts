import type { McpToolInfo } from "@/modules/system/types";

export const MCP_CATALOG: readonly McpToolInfo[] = [
  { description: "Platform health check", name: "health" },
  { description: "Get the community feed posts, optionally filtered by space", name: "getFeed" },
  { description: "Get a specific post with its comments", name: "getPost" },
  {
    description: "Get community events. Admins see inactive/unlisted events too.",
    name: "getEvents",
  },
  {
    description:
      "Get a single event by id, including all event-preparation fields. Admins can see inactive/unlisted events.",
    name: "getEvent",
  },
  { description: "Get published courses", name: "getCourses" },
  { description: "Get all community spaces with post counts", name: "getSpaces" },
  { description: "Get your own profile", name: "getUserProfile" },
  {
    description: "Get published scheduled courses (workshops, bootcamps, webinars)",
    name: "getScheduledCourses",
  },
  {
    description: "Request a one-time URL for uploading an image to storage",
    name: "requestImageUploadUrl",
  },
  {
    description:
      "Create a new post in a space. Optionally attach a photo by providing a public image URL.",
    name: "createPost",
  },
  { description: "Update an existing post.", name: "updatePost" },
  { description: "Add a comment to a post", name: "addComment" },
  { description: "Edit a comment you own (admins can edit any comment)", name: "updateComment" },
  {
    description: "Delete a comment you own (admins can delete any comment)",
    name: "deleteComment",
  },
  { description: "Toggle like on a post", name: "likePost" },
  { description: "Toggle bookmark on a post", name: "bookmarkPost" },
  { description: "Toggle an emoji reaction on a post", name: "reactToPost" },
  { description: "Toggle an emoji reaction on a comment", name: "reactToComment" },
  { description: "Delete a post you own (admins can delete any post)", name: "deletePost" },
  {
    description:
      "Create a new event (admin only). Defaults to inactive/unlisted — pass isActive: true to publish immediately.",
    name: "createEvent",
  },
  {
    description:
      "Update an existing event (admin only). Use this to set preparation fields, attach images, or toggle activation.",
    name: "updateEvent",
  },
  {
    description: "Set an event's active/unlisted state (admin only).",
    name: "setEventActiveState",
  },
  { description: "Delete an event (admin only)", name: "deleteEvent" },
  {
    description: "List talk submissions sent via the public /speak form (admin only).",
    name: "listSpeakerSubmissions",
  },
  {
    description: "Set the status on a talk submission (admin only).",
    name: "updateSpeakerSubmissionStatus",
  },
  { description: "Delete a talk submission (admin only).", name: "deleteSpeakerSubmission" },
  {
    description: "List curated speakers attached to an event, in display order (admin only).",
    name: "listEventSpeakers",
  },
  { description: "Add a speaker to an event manually (admin only).", name: "addEventSpeaker" },
  {
    description: "Promote a TalkSubmission into a curated per-event Speaker (admin only).",
    name: "addEventSpeakerFromSubmission",
  },
  { description: "Update a curated event speaker (admin only).", name: "updateEventSpeaker" },
  {
    description: "Remove a curated speaker from an event (admin only).",
    name: "deleteEventSpeaker",
  },
  {
    description: "Set the display order of an event's speakers (admin only).",
    name: "reorderEventSpeakers",
  },
  {
    description: "Read the slide-generator working state for a scope (admin only).",
    name: "getSlideGeneratorState",
  },
  {
    description: "Write the full slide-generator state for a scope (admin only).",
    name: "putSlideGeneratorState",
  },
  {
    description: "List saved slide-generator style presets (admin only).",
    name: "listSlideStylePresets",
  },
  { description: "Get one slide style preset by id (admin only).", name: "getSlideStylePreset" },
  {
    description: "Save a SlideTemplate as a named, reusable style preset (admin only).",
    name: "createSlideStylePreset",
  },
  {
    description: "Rename or update the template stored in a slide style preset (admin only).",
    name: "updateSlideStylePreset",
  },
  { description: "Delete a slide style preset (admin only).", name: "deleteSlideStylePreset" },
  { description: "Create a new course (admin only)", name: "createCourse" },
  { description: "Update a course (admin only)", name: "updateCourse" },
  { description: "Delete a course (admin only)", name: "deleteCourse" },
  { description: "Create a new scheduled course (admin only)", name: "createScheduledCourse" },
  { description: "Update a scheduled course (admin only)", name: "updateScheduledCourse" },
  { description: "Delete a scheduled course (admin only)", name: "deleteScheduledCourse" },
  { description: "List community users (admin only)", name: "listUsers" },
  {
    description: "List connected social media accounts the admin can post to.",
    name: "listSocialAccounts",
  },
  {
    description: "List social posts. Use range to filter past vs upcoming.",
    name: "listSocialPosts",
  },
  {
    description: "Create a social post: save as draft, schedule, or publish now.",
    name: "createSocialPost",
  },
  { description: "Edit a draft or scheduled social post.", name: "updateSocialPost" },
  { description: "Kick off publishing for a social post.", name: "publishSocialPost" },
  { description: "Delete a social post from the scheduler.", name: "deleteSocialPost" },
  { description: "Get a published content page by slug", name: "get_page" },
  { description: "List content pages (admin)", name: "list_pages" },
];
