/**
 * Single SQLite table set applied to every city D1.
 * Unlike Robinson's pgSchema(name), D1 isolation is physical (one DB per city).
 */
/* oxlint-disable import/namespace -- domain schema barrels */
/* oxlint-disable prefer-destructuring -- re-export table aliases */

import * as activityTables from "@/modules/activity/schema.tenant";
import * as badgeTables from "@/modules/badges/schema.tenant";
import * as cityTables from "@/modules/cities/schema.tenant";
import * as community from "@/modules/community/schema.tenant";
import * as connectionTables from "@/modules/connections/schema.tenant";
import * as courses from "@/modules/courses/schema.tenant";
import * as email from "@/modules/email/schema.tenant";
import * as events from "@/modules/events/schema.tenant";
import * as pages from "@/modules/pages/schema.tenant";
import * as pollTables from "@/modules/polls/schema.tenant";
import * as roleTables from "@/modules/roles/schema.tenant";
import * as slides from "@/modules/slides/schema.tenant";
import * as social from "@/modules/social/schema.tenant";
import * as talks from "@/modules/talks/schema.tenant";
import * as tierTables from "@/modules/tiers/schema.tenant";

export const eventsTable = events.events;
export const { eventRsvps } = events;
export const { eventAgendaItems } = events;
export const { eventLumaInterests } = events;
export const { eventResources } = events;
export type EventRow = events.EventRow;

export const { spaces } = community;
export const { posts } = community;
export const { comments } = community;
export const { reactions } = community;
export const { commentReactions } = community;
export const { bookmarks } = community;
export const { likes } = community;
export const { spaceViews } = community;
export type PostRow = community.PostRow;

export const coursesTable = courses.courses;
export const { lessons } = courses;
export const { courseEnrollments } = courses;
export const { scheduledCourses } = courses;

export const { speakers } = talks;
export const { talkComments } = talks;
export const { talkSubmissions } = talks;

export const { emailCampaigns } = email;
export const { emailTemplates } = email;
export const { emailSends } = email;
export const { emailAutomations } = email;
export const { emailSettings } = email;

export const { socialAccounts } = social;
export const { socialPosts } = social;

export const { slideGeneratorStates } = slides;
export const { slideStylePresets } = slides;
export const { slideExportJobs } = slides;

export const pagesTable = pages.pages;
export const { badges } = badgeTables;
export const { userBadges } = badgeTables;
export const { notifications } = pages;
export const { roles } = roleTables;
export const { activities } = activityTables;
export const { cities } = cityTables;
export const { connections } = connectionTables;
export const { polls } = pollTables;
export const { pollOptions } = pollTables;
export const { pollVotes } = pollTables;
export const { membershipTiers } = tierTables;

/** Stable object of tenant tables (no per-schema factory needed on D1). */
export function createTenantSchema() {
  return {
    activities: activityTables.activities,
    badges: badgeTables.badges,
    bookmarks: community.bookmarks,
    cities: cityTables.cities,
    commentReactions: community.commentReactions,
    comments: community.comments,
    connections: connectionTables.connections,
    courseEnrollments: courses.courseEnrollments,
    courses: courses.courses,
    emailAutomations: email.emailAutomations,
    emailCampaigns: email.emailCampaigns,
    emailSends: email.emailSends,
    emailSettings: email.emailSettings,
    emailTemplates: email.emailTemplates,
    eventAgendaItems: events.eventAgendaItems,
    eventLumaInterests: events.eventLumaInterests,
    eventResources: events.eventResources,
    eventRsvps: events.eventRsvps,
    events: events.events,
    lessons: courses.lessons,
    likes: community.likes,
    membershipTiers: tierTables.membershipTiers,
    notifications: pages.notifications,
    pages: pages.pages,
    pollOptions: pollTables.pollOptions,
    polls: pollTables.polls,
    pollVotes: pollTables.pollVotes,
    posts: community.posts,
    reactions: community.reactions,
    roles: roleTables.roles,
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
