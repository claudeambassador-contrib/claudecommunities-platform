/**
 * Single SQLite table set applied to every city D1.
 * Unlike Robinson's pgSchema(name), D1 isolation is physical (one DB per city).
 */

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
export const spaceViews = community.spaceViews;
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
export const slideStylePresets = slides.slideStylePresets;
export const slideExportJobs = slides.slideExportJobs;

export const pagesTable = pages.pages;
export const badges = pages.badges;
export const notifications = pages.notifications;

/** Stable object of tenant tables (no per-schema factory needed on D1). */
export function createTenantSchema() {
  return {
    badges: pages.badges,
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
    notifications: pages.notifications,
    pages: pages.pages,
    posts: community.posts,
    reactions: community.reactions,
    slideExportJobs: slides.slideExportJobs,
    slideGeneratorStates: slides.slideGeneratorStates,
    slideStylePresets: slides.slideStylePresets,
    socialAccounts: social.socialAccounts,
    socialPosts: social.socialPosts,
    spaces: community.spaces,
    spaceViews: community.spaceViews,
    speakers: talks.speakers,
    talkSubmissions: talks.talkSubmissions,
  };
}

export type TenantTables = ReturnType<typeof createTenantSchema>;
