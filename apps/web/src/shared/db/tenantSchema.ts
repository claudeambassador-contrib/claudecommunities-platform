/**
 * Single SQLite table set applied to every city D1.
 * Unlike Robinson's pgSchema(name), D1 isolation is physical (one DB per city).
 */
/** biome-ignore-all lint/performance/noNamespaceImport: domain schema barrels */
/** biome-ignore-all lint/style/useDestructuring: re-export table aliases */

import * as badgeTables from "@/modules/badges/schema.tenant";
import * as community from "@/modules/community/schema.tenant";
import * as courses from "@/modules/courses/schema.tenant";
import * as email from "@/modules/email/schema.tenant";
import * as events from "@/modules/events/schema.tenant";
import * as pages from "@/modules/pages/schema.tenant";
import * as slides from "@/modules/slides/schema.tenant";
import * as social from "@/modules/social/schema.tenant";
import * as talks from "@/modules/talks/schema.tenant";

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
export const commentReactions = community.commentReactions;
export const bookmarks = community.bookmarks;
export const likes = community.likes;
export const spaceViews = community.spaceViews;
export type PostRow = community.PostRow;

export const coursesTable = courses.courses;
export const lessons = courses.lessons;
export const courseEnrollments = courses.courseEnrollments;
export const scheduledCourses = courses.scheduledCourses;

export const speakers = talks.speakers;
export const talkComments = talks.talkComments;
export const talkSubmissions = talks.talkSubmissions;

export const emailCampaigns = email.emailCampaigns;
export const emailTemplates = email.emailTemplates;
export const emailSends = email.emailSends;

export const socialAccounts = social.socialAccounts;
export const socialPosts = social.socialPosts;

export const slideGeneratorStates = slides.slideGeneratorStates;
export const slideStylePresets = slides.slideStylePresets;
export const slideExportJobs = slides.slideExportJobs;

export const pagesTable = pages.pages;
export const badges = badgeTables.badges;
export const userBadges = badgeTables.userBadges;
export const notifications = pages.notifications;

/** Stable object of tenant tables (no per-schema factory needed on D1). */
export function createTenantSchema() {
  return {
    badges: badgeTables.badges,
    bookmarks: community.bookmarks,
    commentReactions: community.commentReactions,
    comments: community.comments,
    courseEnrollments: courses.courseEnrollments,
    courses: courses.courses,
    emailCampaigns: email.emailCampaigns,
    emailSends: email.emailSends,
    emailTemplates: email.emailTemplates,
    eventAgendaItems: events.eventAgendaItems,
    eventLumaInterests: events.eventLumaInterests,
    eventResources: events.eventResources,
    eventRsvps: events.eventRsvps,
    events: events.events,
    lessons: courses.lessons,
    likes: community.likes,
    notifications: pages.notifications,
    pages: pages.pages,
    posts: community.posts,
    reactions: community.reactions,
    scheduledCourses: courses.scheduledCourses,
    slideExportJobs: slides.slideExportJobs,
    slideGeneratorStates: slides.slideGeneratorStates,
    slideStylePresets: slides.slideStylePresets,
    socialAccounts: social.socialAccounts,
    socialPosts: social.socialPosts,
    spaces: community.spaces,
    spaceViews: community.spaceViews,
    speakers: talks.speakers,
    talkComments: talks.talkComments,
    talkSubmissions: talks.talkSubmissions,
    userBadges: badgeTables.userBadges,
  };
}

export type TenantTables = ReturnType<typeof createTenantSchema>;
