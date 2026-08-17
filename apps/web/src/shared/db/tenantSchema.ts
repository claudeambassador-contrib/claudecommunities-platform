/**
 * Single SQLite table set applied to every city D1.
 * Unlike Robinson's pgSchema(name), D1 isolation is physical (one DB per city).
 */
import * as events from "@/modules/events/schema.tenant";
import * as community from "@/modules/community/schema.tenant";
import * as courses from "@/modules/courses/schema.tenant";
import * as talks from "@/modules/talks/schema.tenant";
import * as email from "@/modules/email/schema.tenant";
import * as social from "@/modules/social/schema.tenant";
import * as slides from "@/modules/slides/schema.tenant";
import * as pages from "@/modules/pages/schema.tenant";

export const eventsTable = events.events;
export const eventRsvps = events.eventRsvps;
export const eventAgendaItems = events.eventAgendaItems;
export const eventLumaInterests = events.eventLumaInterests;
export const eventResources = events.eventResources;
export type EventRow = events.EventRow;

export const spaces = community.spaces;
export const posts = community.posts;
export const comments = community.comments;
export const reactions = community.reactions;
export const bookmarks = community.bookmarks;
export type PostRow = community.PostRow;

export const coursesTable = courses.courses;
export const lessons = courses.lessons;
export const courseEnrollments = courses.courseEnrollments;

export const speakers = talks.speakers;
export const talkSubmissions = talks.talkSubmissions;

export const emailCampaigns = email.emailCampaigns;
export const emailTemplates = email.emailTemplates;
export const emailSends = email.emailSends;

export const socialAccounts = social.socialAccounts;
export const socialPosts = social.socialPosts;

export const slideGeneratorStates = slides.slideGeneratorStates;
export const slideExportJobs = slides.slideExportJobs;

export const pagesTable = pages.pages;
export const badges = pages.badges;
export const notifications = pages.notifications;

/** Stable object of tenant tables (no per-schema factory needed on D1). */
export function createTenantSchema() {
  return {
    events: events.events,
    eventRsvps: events.eventRsvps,
    eventAgendaItems: events.eventAgendaItems,
    eventLumaInterests: events.eventLumaInterests,
    eventResources: events.eventResources,
    spaces: community.spaces,
    posts: community.posts,
    comments: community.comments,
    reactions: community.reactions,
    bookmarks: community.bookmarks,
    courses: courses.courses,
    lessons: courses.lessons,
    courseEnrollments: courses.courseEnrollments,
    speakers: talks.speakers,
    talkSubmissions: talks.talkSubmissions,
    emailCampaigns: email.emailCampaigns,
    emailTemplates: email.emailTemplates,
    emailSends: email.emailSends,
    socialAccounts: social.socialAccounts,
    socialPosts: social.socialPosts,
    slideGeneratorStates: slides.slideGeneratorStates,
    slideExportJobs: slides.slideExportJobs,
    pages: pages.pages,
    badges: pages.badges,
    notifications: pages.notifications,
  };
}

export type TenantTables = ReturnType<typeof createTenantSchema>;
