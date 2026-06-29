-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TenantSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "gaId" TEXT,
    "fromEmail" TEXT,
    "senderDomain" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserTenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingAdminGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Role" (
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("tenantId", "name")
);
INSERT INTO "new_Role" ("tenantId", "createdAt", "description", "isSystem", "name", "permissions", "updatedAt") SELECT 'au', "createdAt", "description", "isSystem", "name", "permissions", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE TABLE "new_Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Badge" ("tenantId", "color", "createdAt", "description", "icon", "id", "name") SELECT 'au', "color", "createdAt", "description", "icon", "id", "name" FROM "Badge";
DROP TABLE "Badge";
ALTER TABLE "new_Badge" RENAME TO "Badge";
CREATE UNIQUE INDEX "Badge_tenantId_name_key" ON "Badge"("tenantId", "name");
CREATE TABLE "new_UserBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserBadge" ("tenantId", "awardedAt", "badgeId", "id", "userId") SELECT 'au', "awardedAt", "badgeId", "id", "userId" FROM "UserBadge";
DROP TABLE "UserBadge";
ALTER TABLE "new_UserBadge" RENAME TO "UserBadge";
CREATE UNIQUE INDEX "UserBadge_tenantId_userId_badgeId_key" ON "UserBadge"("tenantId", "userId", "badgeId");
CREATE TABLE "new_SpaceGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SpaceGroup" ("tenantId", "createdAt", "icon", "id", "name", "order", "updatedAt") SELECT 'au', "createdAt", "icon", "id", "name", "order", "updatedAt" FROM "SpaceGroup";
DROP TABLE "SpaceGroup";
ALTER TABLE "new_SpaceGroup" RENAME TO "SpaceGroup";
CREATE INDEX "SpaceGroup_tenantId_idx" ON "SpaceGroup"("tenantId");
CREATE TABLE "new_Space" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requiredTierId" TEXT,
    "groupId" TEXT,
    CONSTRAINT "Space_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SpaceGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Space_requiredTierId_fkey" FOREIGN KEY ("requiredTierId") REFERENCES "MembershipTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Space" ("tenantId", "color", "createdAt", "description", "groupId", "icon", "id", "isPrivate", "name", "order", "requiredTierId", "slug", "updatedAt") SELECT 'au', "color", "createdAt", "description", "groupId", "icon", "id", "isPrivate", "name", "order", "requiredTierId", "slug", "updatedAt" FROM "Space";
DROP TABLE "Space";
ALTER TABLE "new_Space" RENAME TO "Space";
CREATE UNIQUE INDEX "Space_tenantId_slug_key" ON "Space"("tenantId", "slug");
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    CONSTRAINT "Post_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("tenantId", "authorId", "content", "createdAt", "id", "isPinned", "mediaType", "mediaUrl", "spaceId", "title", "updatedAt") SELECT 'au', "authorId", "content", "createdAt", "id", "isPinned", "mediaType", "mediaUrl", "spaceId", "title", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_tenantId_idx" ON "Post"("tenantId");
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("tenantId", "authorId", "content", "createdAt", "id", "parentId", "postId", "updatedAt") SELECT 'au', "authorId", "content", "createdAt", "id", "parentId", "postId", "updatedAt" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE INDEX "Comment_tenantId_idx" ON "Comment"("tenantId");
CREATE TABLE "new_Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reaction" ("tenantId", "createdAt", "emoji", "id", "postId", "userId") SELECT 'au', "createdAt", "emoji", "id", "postId", "userId" FROM "Reaction";
DROP TABLE "Reaction";
ALTER TABLE "new_Reaction" RENAME TO "Reaction";
CREATE UNIQUE INDEX "Reaction_tenantId_userId_postId_emoji_key" ON "Reaction"("tenantId", "userId", "postId", "emoji");
CREATE TABLE "new_CommentReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CommentReaction" ("tenantId", "commentId", "createdAt", "emoji", "id", "userId") SELECT 'au', "commentId", "createdAt", "emoji", "id", "userId" FROM "CommentReaction";
DROP TABLE "CommentReaction";
ALTER TABLE "new_CommentReaction" RENAME TO "CommentReaction";
CREATE UNIQUE INDEX "CommentReaction_tenantId_userId_commentId_emoji_key" ON "CommentReaction"("tenantId", "userId", "commentId", "emoji");
CREATE TABLE "new_Like" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "Like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Like" ("tenantId", "createdAt", "id", "postId", "userId") SELECT 'au', "createdAt", "id", "postId", "userId" FROM "Like";
DROP TABLE "Like";
ALTER TABLE "new_Like" RENAME TO "Like";
CREATE UNIQUE INDEX "Like_tenantId_userId_postId_key" ON "Like"("tenantId", "userId", "postId");
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "location" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'meetup',
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "maxAttendees" INTEGER,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "meetingUrl" TEXT,
    "imageUrl" TEXT,
    "lumaUrl" TEXT,
    "lumaEventId" TEXT,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "headerText" TEXT,
    "footerText" TEXT,
    "feedbackUrl" TEXT,
    "claudienceSessionCode" TEXT,
    "claudienceSessionPassword" TEXT,
    "claudienceSurveyId" TEXT,
    "claudienceSurveyUrl" TEXT,
    "claudienceSessionUrl" TEXT,
    "claudienceNotificationEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("tenantId", "city", "claudienceNotificationEmail", "claudienceSessionCode", "claudienceSessionPassword", "claudienceSessionUrl", "claudienceSurveyId", "claudienceSurveyUrl", "createdAt", "description", "endTime", "eventType", "feedbackUrl", "footerText", "headerText", "id", "imageUrl", "isActive", "isOnline", "location", "lumaEventId", "lumaUrl", "maxAttendees", "meetingUrl", "rsvpEnabled", "slug", "startTime", "timezone", "title", "updatedAt") SELECT 'au', "city", "claudienceNotificationEmail", "claudienceSessionCode", "claudienceSessionPassword", "claudienceSessionUrl", "claudienceSurveyId", "claudienceSurveyUrl", "createdAt", "description", "endTime", "eventType", "feedbackUrl", "footerText", "headerText", "id", "imageUrl", "isActive", "isOnline", "location", "lumaEventId", "lumaUrl", "maxAttendees", "meetingUrl", "rsvpEnabled", "slug", "startTime", "timezone", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_tenantId_slug_key" ON "Event"("tenantId", "slug");
CREATE TABLE "new_EventAgendaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "title" TEXT,
    "description" TEXT,
    "speakerId" TEXT,
    "submissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventAgendaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventAgendaItem_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventAgendaItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TalkSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EventAgendaItem" ("tenantId", "createdAt", "description", "endTime", "eventId", "id", "order", "speakerId", "startTime", "submissionId", "title", "type", "updatedAt") SELECT 'au', "createdAt", "description", "endTime", "eventId", "id", "order", "speakerId", "startTime", "submissionId", "title", "type", "updatedAt" FROM "EventAgendaItem";
DROP TABLE "EventAgendaItem";
ALTER TABLE "new_EventAgendaItem" RENAME TO "EventAgendaItem";
CREATE INDEX "EventAgendaItem_tenantId_eventId_order_idx" ON "EventAgendaItem"("tenantId", "eventId", "order");
CREATE INDEX "EventAgendaItem_tenantId_speakerId_idx" ON "EventAgendaItem"("tenantId", "speakerId");
CREATE TABLE "new_Speaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "bio" TEXT,
    "talkTitle" TEXT,
    "talkDescription" TEXT,
    "talkDescriptionShort" TEXT,
    "headshotUrl" TEXT,
    "companyLogoUrl" TEXT,
    "twitterHandle" TEXT,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "submissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Speaker_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Speaker_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TalkSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Speaker" ("tenantId", "bio", "company", "companyLogoUrl", "createdAt", "eventId", "headshotUrl", "id", "linkedinUrl", "name", "order", "submissionId", "talkDescription", "talkDescriptionShort", "talkTitle", "title", "twitterHandle", "updatedAt", "websiteUrl") SELECT 'au', "bio", "company", "companyLogoUrl", "createdAt", "eventId", "headshotUrl", "id", "linkedinUrl", "name", "order", "submissionId", "talkDescription", "talkDescriptionShort", "talkTitle", "title", "twitterHandle", "updatedAt", "websiteUrl" FROM "Speaker";
DROP TABLE "Speaker";
ALTER TABLE "new_Speaker" RENAME TO "Speaker";
CREATE INDEX "Speaker_tenantId_eventId_order_idx" ON "Speaker"("tenantId", "eventId", "order");
CREATE TABLE "new_EventResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    CONSTRAINT "EventResource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventResource" ("tenantId", "createdAt", "description", "eventId", "fileName", "fileSize", "fileUrl", "id", "mimeType", "order", "title", "uploadedBy") SELECT 'au', "createdAt", "description", "eventId", "fileName", "fileSize", "fileUrl", "id", "mimeType", "order", "title", "uploadedBy" FROM "EventResource";
DROP TABLE "EventResource";
ALTER TABLE "new_EventResource" RENAME TO "EventResource";
CREATE INDEX "EventResource_tenantId_eventId_idx" ON "EventResource"("tenantId", "eventId");
CREATE TABLE "new_EventRSVP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'going',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventRSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventRSVP" ("tenantId", "createdAt", "eventId", "id", "status", "userId") SELECT 'au', "createdAt", "eventId", "id", "status", "userId" FROM "EventRSVP";
DROP TABLE "EventRSVP";
ALTER TABLE "new_EventRSVP" RENAME TO "EventRSVP";
CREATE UNIQUE INDEX "EventRSVP_tenantId_userId_eventId_key" ON "EventRSVP"("tenantId", "userId", "eventId");
CREATE TABLE "new_EventLumaInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLumaInterest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventLumaInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventLumaInterest" ("tenantId", "createdAt", "eventId", "id", "notifiedAt", "userId") SELECT 'au', "createdAt", "eventId", "id", "notifiedAt", "userId" FROM "EventLumaInterest";
DROP TABLE "EventLumaInterest";
ALTER TABLE "new_EventLumaInterest" RENAME TO "EventLumaInterest";
CREATE INDEX "EventLumaInterest_tenantId_eventId_idx" ON "EventLumaInterest"("tenantId", "eventId");
CREATE UNIQUE INDEX "EventLumaInterest_tenantId_userId_eventId_key" ON "EventLumaInterest"("tenantId", "userId", "eventId");
CREATE TABLE "new_Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "Bookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bookmark" ("tenantId", "createdAt", "id", "postId", "userId") SELECT 'au', "createdAt", "id", "postId", "userId" FROM "Bookmark";
DROP TABLE "Bookmark";
ALTER TABLE "new_Bookmark" RENAME TO "Bookmark";
CREATE UNIQUE INDEX "Bookmark_tenantId_userId_postId_key" ON "Bookmark"("tenantId", "userId", "postId");
CREATE TABLE "new_Poll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    CONSTRAINT "Poll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Poll" ("tenantId", "createdAt", "endsAt", "id", "postId", "question") SELECT 'au', "createdAt", "endsAt", "id", "postId", "question" FROM "Poll";
DROP TABLE "Poll";
ALTER TABLE "new_Poll" RENAME TO "Poll";
CREATE UNIQUE INDEX "Poll_postId_key" ON "Poll"("postId");
CREATE TABLE "new_PollOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pollId" TEXT NOT NULL,
    CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PollOption" ("tenantId", "id", "order", "pollId", "text") SELECT 'au', "id", "order", "pollId", "text" FROM "PollOption";
DROP TABLE "PollOption";
ALTER TABLE "new_PollOption" RENAME TO "PollOption";
CREATE INDEX "PollOption_tenantId_idx" ON "PollOption"("tenantId");
CREATE TABLE "new_PollVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PollVote" ("tenantId", "createdAt", "id", "optionId", "userId") SELECT 'au', "createdAt", "id", "optionId", "userId" FROM "PollVote";
DROP TABLE "PollVote";
ALTER TABLE "new_PollVote" RENAME TO "PollVote";
CREATE UNIQUE INDEX "PollVote_tenantId_userId_optionId_key" ON "PollVote"("tenantId", "userId", "optionId");
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    CONSTRAINT "Attachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("tenantId", "createdAt", "id", "name", "postId", "size", "type", "url") SELECT 'au', "createdAt", "id", "name", "postId", "size", "type", "url" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");
CREATE TABLE "new_Mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "Mention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Mention" ("tenantId", "createdAt", "id", "postId", "userId") SELECT 'au', "createdAt", "id", "postId", "userId" FROM "Mention";
DROP TABLE "Mention";
ALTER TABLE "new_Mention" RENAME TO "Mention";
CREATE UNIQUE INDEX "Mention_tenantId_userId_postId_key" ON "Mention"("tenantId", "userId", "postId");
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("tenantId", "createdAt", "data", "id", "type", "userId") SELECT 'au', "createdAt", "data", "id", "type", "userId" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_tenantId_idx" ON "Activity"("tenantId");
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("tenantId", "createdAt", "emailSent", "id", "isRead", "link", "message", "title", "type", "userId") SELECT 'au', "createdAt", "emailSent", "id", "isRead", "link", "message", "title", "type", "userId" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
CREATE TABLE "new_EmailPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "replies" BOOLEAN NOT NULL DEFAULT true,
    "likes" BOOLEAN NOT NULL DEFAULT false,
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "eventReminders" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "EmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailPreference" ("tenantId", "eventReminders", "id", "likes", "mentions", "messages", "replies", "updatedAt", "userId", "weeklyDigest") SELECT 'au', "eventReminders", "id", "likes", "mentions", "messages", "replies", "updatedAt", "userId", "weeklyDigest" FROM "EmailPreference";
DROP TABLE "EmailPreference";
ALTER TABLE "new_EmailPreference" RENAME TO "EmailPreference";
CREATE UNIQUE INDEX "EmailPreference_userId_key" ON "EmailPreference"("userId");
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "duration" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requiredTierId" TEXT,
    CONSTRAINT "Course_requiredTierId_fkey" FOREIGN KEY ("requiredTierId") REFERENCES "MembershipTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("tenantId", "createdAt", "description", "difficulty", "duration", "id", "isFree", "isPublished", "order", "requiredTierId", "slug", "thumbnail", "title", "updatedAt") SELECT 'au', "createdAt", "description", "difficulty", "duration", "id", "isFree", "isPublished", "order", "requiredTierId", "slug", "thumbnail", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_tenantId_slug_key" ON "Course"("tenantId", "slug");
CREATE TABLE "new_Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoUrl" TEXT,
    "duration" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lesson" ("tenantId", "content", "courseId", "createdAt", "duration", "id", "isPreview", "order", "slug", "title", "updatedAt", "videoUrl") SELECT 'au', "content", "courseId", "createdAt", "duration", "id", "isPreview", "order", "slug", "title", "updatedAt", "videoUrl" FROM "Lesson";
DROP TABLE "Lesson";
ALTER TABLE "new_Lesson" RENAME TO "Lesson";
CREATE UNIQUE INDEX "Lesson_tenantId_courseId_slug_key" ON "Lesson"("tenantId", "courseId", "slug");
CREATE TABLE "new_CourseEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseEnrollment" ("tenantId", "completedAt", "courseId", "createdAt", "id", "progress", "updatedAt", "userId") SELECT 'au', "completedAt", "courseId", "createdAt", "id", "progress", "updatedAt", "userId" FROM "CourseEnrollment";
DROP TABLE "CourseEnrollment";
ALTER TABLE "new_CourseEnrollment" RENAME TO "CourseEnrollment";
CREATE UNIQUE INDEX "CourseEnrollment_tenantId_userId_courseId_key" ON "CourseEnrollment"("tenantId", "userId", "courseId");
CREATE TABLE "new_LessonProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LessonProgress" ("tenantId", "completed", "completedAt", "createdAt", "id", "lessonId", "userId") SELECT 'au', "completed", "completedAt", "createdAt", "id", "lessonId", "userId" FROM "LessonProgress";
DROP TABLE "LessonProgress";
ALTER TABLE "new_LessonProgress" RENAME TO "LessonProgress";
CREATE UNIQUE INDEX "LessonProgress_tenantId_userId_lessonId_key" ON "LessonProgress"("tenantId", "userId", "lessonId");
CREATE TABLE "new_MembershipTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "yearlyPrice" REAL,
    "features" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MembershipTier" ("tenantId", "color", "createdAt", "description", "features", "id", "isActive", "name", "order", "price", "slug", "updatedAt", "yearlyPrice") SELECT 'au', "color", "createdAt", "description", "features", "id", "isActive", "name", "order", "price", "slug", "updatedAt", "yearlyPrice" FROM "MembershipTier";
DROP TABLE "MembershipTier";
ALTER TABLE "new_MembershipTier" RENAME TO "MembershipTier";
CREATE UNIQUE INDEX "MembershipTier_tenantId_name_key" ON "MembershipTier"("tenantId", "name");
CREATE UNIQUE INDEX "MembershipTier_tenantId_slug_key" ON "MembershipTier"("tenantId", "slug");
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    CONSTRAINT "Subscription_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("tenantId", "cancelledAt", "createdAt", "currentPeriodEnd", "currentPeriodStart", "id", "interval", "status", "stripeCustomerId", "stripeSubscriptionId", "tierId", "updatedAt", "userId") SELECT 'au', "cancelledAt", "createdAt", "currentPeriodEnd", "currentPeriodStart", "id", "interval", "status", "stripeCustomerId", "stripeSubscriptionId", "tierId", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_tenantId_userId_tierId_key" ON "Subscription"("tenantId", "userId", "tierId");
CREATE TABLE "new_PageView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "PageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PageView" ("tenantId", "createdAt", "id", "path", "referrer", "userAgent", "userId") SELECT 'au', "createdAt", "id", "path", "referrer", "userAgent", "userId" FROM "PageView";
DROP TABLE "PageView";
ALTER TABLE "new_PageView" RENAME TO "PageView";
CREATE INDEX "PageView_tenantId_idx" ON "PageView"("tenantId");
CREATE TABLE "new_AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "event" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AnalyticsEvent" ("tenantId", "createdAt", "data", "event", "id", "userId") SELECT 'au', "createdAt", "data", "event", "id", "userId" FROM "AnalyticsEvent";
DROP TABLE "AnalyticsEvent";
ALTER TABLE "new_AnalyticsEvent" RENAME TO "AnalyticsEvent";
CREATE INDEX "AnalyticsEvent_tenantId_idx" ON "AnalyticsEvent"("tenantId");
CREATE TABLE "new_DigestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postCount" INTEGER NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DigestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DigestLog" ("tenantId", "eventCount", "id", "memberCount", "postCount", "sentAt", "userId") SELECT 'au', "eventCount", "id", "memberCount", "postCount", "sentAt", "userId" FROM "DigestLog";
DROP TABLE "DigestLog";
ALTER TABLE "new_DigestLog" RENAME TO "DigestLog";
CREATE INDEX "DigestLog_tenantId_idx" ON "DigestLog"("tenantId");
CREATE TABLE "new_Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requesterId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    CONSTRAINT "Connection_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("tenantId", "createdAt", "id", "receiverId", "requesterId", "status", "updatedAt") SELECT 'au', "createdAt", "id", "receiverId", "requesterId", "status", "updatedAt" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE UNIQUE INDEX "Connection_tenantId_requesterId_receiverId_key" ON "Connection"("tenantId", "requesterId", "receiverId");
CREATE TABLE "new_LeaderboardLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "minPoints" INTEGER NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LeaderboardLevel" ("tenantId", "color", "createdAt", "icon", "id", "level", "minPoints", "name") SELECT 'au', "color", "createdAt", "icon", "id", "level", "minPoints", "name" FROM "LeaderboardLevel";
DROP TABLE "LeaderboardLevel";
ALTER TABLE "new_LeaderboardLevel" RENAME TO "LeaderboardLevel";
CREATE UNIQUE INDEX "LeaderboardLevel_tenantId_level_key" ON "LeaderboardLevel"("tenantId", "level");
CREATE TABLE "new_EmailCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "blocks" TEXT,
    "templateType" TEXT NOT NULL DEFAULT 'custom',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "segmentQuery" TEXT,
    "listId" TEXT,
    "previewText" TEXT,
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailCampaign_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailCampaign" ("tenantId", "blocks", "bounceCount", "clickCount", "createdAt", "failedCount", "html", "id", "listId", "name", "openCount", "previewText", "recipientCount", "scheduledAt", "segmentQuery", "sentAt", "sentCount", "status", "subject", "templateType", "unsubscribeCount", "updatedAt") SELECT 'au', "blocks", "bounceCount", "clickCount", "createdAt", "failedCount", "html", "id", "listId", "name", "openCount", "previewText", "recipientCount", "scheduledAt", "segmentQuery", "sentAt", "sentCount", "status", "subject", "templateType", "unsubscribeCount", "updatedAt" FROM "EmailCampaign";
DROP TABLE "EmailCampaign";
ALTER TABLE "new_EmailCampaign" RENAME TO "EmailCampaign";
CREATE INDEX "EmailCampaign_tenantId_idx" ON "EmailCampaign"("tenantId");
CREATE TABLE "new_EmailSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "errorMsg" TEXT,
    "resendMessageId" TEXT,
    "openedAt" DATETIME,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" DATETIME,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" DATETIME,
    "bouncedAt" DATETIME,
    "bounceType" TEXT,
    "unsubscribeToken" TEXT,
    "variantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailSend_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "EmailABVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailSend" ("tenantId", "bounceType", "bouncedAt", "campaignId", "clickCount", "clickedAt", "createdAt", "deliveredAt", "errorMsg", "id", "openCount", "openedAt", "resendMessageId", "sentAt", "status", "unsubscribeToken", "userId", "variantId") SELECT 'au', "bounceType", "bouncedAt", "campaignId", "clickCount", "clickedAt", "createdAt", "deliveredAt", "errorMsg", "id", "openCount", "openedAt", "resendMessageId", "sentAt", "status", "unsubscribeToken", "userId", "variantId" FROM "EmailSend";
DROP TABLE "EmailSend";
ALTER TABLE "new_EmailSend" RENAME TO "EmailSend";
CREATE UNIQUE INDEX "EmailSend_tenantId_campaignId_userId_key" ON "EmailSend"("tenantId", "campaignId", "userId");
CREATE UNIQUE INDEX "EmailSend_tenantId_unsubscribeToken_key" ON "EmailSend"("tenantId", "unsubscribeToken");
CREATE TABLE "new_EmailSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmailSegment" ("tenantId", "createdAt", "description", "filters", "id", "name", "updatedAt") SELECT 'au', "createdAt", "description", "filters", "id", "name", "updatedAt" FROM "EmailSegment";
DROP TABLE "EmailSegment";
ALTER TABLE "new_EmailSegment" RENAME TO "EmailSegment";
CREATE INDEX "EmailSegment_tenantId_idx" ON "EmailSegment"("tenantId");
CREATE TABLE "new_EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "blocks" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmailTemplate" ("tenantId", "blocks", "category", "createdAt", "description", "html", "id", "isPublic", "name", "thumbnailUrl", "updatedAt") SELECT 'au', "blocks", "category", "createdAt", "description", "html", "id", "isPublic", "name", "thumbnailUrl", "updatedAt" FROM "EmailTemplate";
DROP TABLE "EmailTemplate";
ALTER TABLE "new_EmailTemplate" RENAME TO "EmailTemplate";
CREATE INDEX "EmailTemplate_tenantId_idx" ON "EmailTemplate"("tenantId");
CREATE TABLE "new_EmailSavedBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "blockType" TEXT NOT NULL,
    "blockData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmailSavedBlock" ("tenantId", "blockData", "blockType", "category", "createdAt", "description", "id", "name", "updatedAt") SELECT 'au', "blockData", "blockType", "category", "createdAt", "description", "id", "name", "updatedAt" FROM "EmailSavedBlock";
DROP TABLE "EmailSavedBlock";
ALTER TABLE "new_EmailSavedBlock" RENAME TO "EmailSavedBlock";
CREATE INDEX "EmailSavedBlock_tenantId_idx" ON "EmailSavedBlock"("tenantId");
CREATE TABLE "new_ContactList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ContactList" ("tenantId", "createdAt", "description", "id", "isDefault", "name", "updatedAt") SELECT 'au', "createdAt", "description", "id", "isDefault", "name", "updatedAt" FROM "ContactList";
DROP TABLE "ContactList";
ALTER TABLE "new_ContactList" RENAME TO "ContactList";
CREATE INDEX "ContactList_tenantId_idx" ON "ContactList"("tenantId");
CREATE TABLE "new_ContactListMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'subscribed',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContactListMember" ("tenantId", "id", "joinedAt", "listId", "status", "userId") SELECT 'au', "id", "joinedAt", "listId", "status", "userId" FROM "ContactListMember";
DROP TABLE "ContactListMember";
ALTER TABLE "new_ContactListMember" RENAME TO "ContactListMember";
CREATE UNIQUE INDEX "ContactListMember_tenantId_listId_userId_key" ON "ContactListMember"("tenantId", "listId", "userId");
CREATE TABLE "new_EmailTrackingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL,
    "sendId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTrackingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailTrackingEvent_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "EmailSend" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailTrackingEvent" ("tenantId", "campaignId", "createdAt", "eventType", "id", "ipAddress", "metadata", "sendId", "url", "userAgent", "userId") SELECT 'au', "campaignId", "createdAt", "eventType", "id", "ipAddress", "metadata", "sendId", "url", "userAgent", "userId" FROM "EmailTrackingEvent";
DROP TABLE "EmailTrackingEvent";
ALTER TABLE "new_EmailTrackingEvent" RENAME TO "EmailTrackingEvent";
CREATE INDEX "EmailTrackingEvent_tenantId_campaignId_idx" ON "EmailTrackingEvent"("tenantId", "campaignId");
CREATE INDEX "EmailTrackingEvent_tenantId_sendId_idx" ON "EmailTrackingEvent"("tenantId", "sendId");
CREATE INDEX "EmailTrackingEvent_tenantId_eventType_idx" ON "EmailTrackingEvent"("tenantId", "eventType");
CREATE INDEX "EmailTrackingEvent_tenantId_createdAt_idx" ON "EmailTrackingEvent"("tenantId", "createdAt");
CREATE TABLE "new_EmailTrackedLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTrackedLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailTrackedLink" ("tenantId", "campaignId", "clickCount", "createdAt", "id", "originalUrl", "trackingCode") SELECT 'au', "campaignId", "clickCount", "createdAt", "id", "originalUrl", "trackingCode" FROM "EmailTrackedLink";
DROP TABLE "EmailTrackedLink";
ALTER TABLE "new_EmailTrackedLink" RENAME TO "EmailTrackedLink";
CREATE INDEX "EmailTrackedLink_tenantId_trackingCode_idx" ON "EmailTrackedLink"("tenantId", "trackingCode");
CREATE UNIQUE INDEX "EmailTrackedLink_tenantId_campaignId_originalUrl_key" ON "EmailTrackedLink"("tenantId", "campaignId", "originalUrl");
CREATE UNIQUE INDEX "EmailTrackedLink_tenantId_trackingCode_key" ON "EmailTrackedLink"("tenantId", "trackingCode");
CREATE TABLE "new_EmailABTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL,
    "testType" TEXT NOT NULL DEFAULT 'subject',
    "winnerMetric" TEXT NOT NULL DEFAULT 'opens',
    "splitPercentage" INTEGER NOT NULL DEFAULT 50,
    "winnerVariantId" TEXT,
    "autoSelectAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailABTest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailABTest" ("tenantId", "autoSelectAt", "campaignId", "createdAt", "id", "splitPercentage", "status", "testType", "updatedAt", "winnerMetric", "winnerVariantId") SELECT 'au', "autoSelectAt", "campaignId", "createdAt", "id", "splitPercentage", "status", "testType", "updatedAt", "winnerMetric", "winnerVariantId" FROM "EmailABTest";
DROP TABLE "EmailABTest";
ALTER TABLE "new_EmailABTest" RENAME TO "EmailABTest";
CREATE UNIQUE INDEX "EmailABTest_campaignId_key" ON "EmailABTest"("campaignId");
CREATE TABLE "new_EmailABVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "html" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailABVariant_testId_fkey" FOREIGN KEY ("testId") REFERENCES "EmailABTest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailABVariant" ("tenantId", "clickCount", "createdAt", "html", "id", "isWinner", "name", "openCount", "sentCount", "subject", "testId") SELECT 'au', "clickCount", "createdAt", "html", "id", "isWinner", "name", "openCount", "sentCount", "subject", "testId" FROM "EmailABVariant";
DROP TABLE "EmailABVariant";
ALTER TABLE "new_EmailABVariant" RENAME TO "EmailABVariant";
CREATE INDEX "EmailABVariant_tenantId_idx" ON "EmailABVariant"("tenantId");
CREATE TABLE "new_EmailAutomation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmailAutomation" ("tenantId", "createdAt", "description", "id", "name", "status", "triggerData", "triggerType", "updatedAt") SELECT 'au', "createdAt", "description", "id", "name", "status", "triggerData", "triggerType", "updatedAt" FROM "EmailAutomation";
DROP TABLE "EmailAutomation";
ALTER TABLE "new_EmailAutomation" RENAME TO "EmailAutomation";
CREATE INDEX "EmailAutomation_tenantId_idx" ON "EmailAutomation"("tenantId");
CREATE TABLE "new_AutomationStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "automationId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AutomationStep" ("tenantId", "automationId", "config", "createdAt", "id", "stepOrder", "stepType", "updatedAt") SELECT 'au', "automationId", "config", "createdAt", "id", "stepOrder", "stepType", "updatedAt" FROM "AutomationStep";
DROP TABLE "AutomationStep";
ALTER TABLE "new_AutomationStep" RENAME TO "AutomationStep";
CREATE INDEX "AutomationStep_tenantId_automationId_idx" ON "AutomationStep"("tenantId", "automationId");
CREATE UNIQUE INDEX "AutomationStep_tenantId_automationId_stepOrder_key" ON "AutomationStep"("tenantId", "automationId", "stepOrder");
CREATE TABLE "new_AutomationEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "automationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "nextActionAt" DATETIME,
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AutomationEnrollment_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AutomationEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AutomationEnrollment" ("tenantId", "automationId", "completedAt", "currentStep", "enrolledAt", "id", "nextActionAt", "status", "userId") SELECT 'au', "automationId", "completedAt", "currentStep", "enrolledAt", "id", "nextActionAt", "status", "userId" FROM "AutomationEnrollment";
DROP TABLE "AutomationEnrollment";
ALTER TABLE "new_AutomationEnrollment" RENAME TO "AutomationEnrollment";
CREATE INDEX "AutomationEnrollment_tenantId_status_nextActionAt_idx" ON "AutomationEnrollment"("tenantId", "status", "nextActionAt");
CREATE UNIQUE INDEX "AutomationEnrollment_tenantId_automationId_userId_key" ON "AutomationEnrollment"("tenantId", "automationId", "userId");
CREATE TABLE "new_UserTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_UserTag" ("tenantId", "category", "createdAt", "id", "name") SELECT 'au', "category", "createdAt", "id", "name" FROM "UserTag";
DROP TABLE "UserTag";
ALTER TABLE "new_UserTag" RENAME TO "UserTag";
CREATE UNIQUE INDEX "UserTag_tenantId_name_key" ON "UserTag"("tenantId", "name");
CREATE TABLE "new_UserTagAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTagAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "UserTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserTagAssignment" ("tenantId", "createdAt", "id", "tagId", "userId") SELECT 'au', "createdAt", "id", "tagId", "userId" FROM "UserTagAssignment";
DROP TABLE "UserTagAssignment";
ALTER TABLE "new_UserTagAssignment" RENAME TO "UserTagAssignment";
CREATE UNIQUE INDEX "UserTagAssignment_tenantId_userId_tagId_key" ON "UserTagAssignment"("tenantId", "userId", "tagId");
CREATE TABLE "new_SpaceView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SpaceView" ("tenantId", "id", "spaceId", "userId", "viewedAt") SELECT 'au', "id", "spaceId", "userId", "viewedAt" FROM "SpaceView";
DROP TABLE "SpaceView";
ALTER TABLE "new_SpaceView" RENAME TO "SpaceView";
CREATE INDEX "SpaceView_tenantId_userId_idx" ON "SpaceView"("tenantId", "userId");
CREATE INDEX "SpaceView_tenantId_spaceId_idx" ON "SpaceView"("tenantId", "spaceId");
CREATE UNIQUE INDEX "SpaceView_tenantId_userId_spaceId_key" ON "SpaceView"("tenantId", "userId", "spaceId");
CREATE TABLE "new_ScheduledCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "meetingUrl" TEXT,
    "imageUrl" TEXT,
    "registrationUrl" TEXT,
    "courseType" TEXT NOT NULL DEFAULT 'workshop',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "price" TEXT,
    "instructor" TEXT,
    "maxAttendees" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ScheduledCourse" ("tenantId", "city", "courseType", "createdAt", "description", "endTime", "id", "imageUrl", "instructor", "isOnline", "isPublished", "location", "maxAttendees", "meetingUrl", "price", "registrationUrl", "slug", "startTime", "timezone", "title", "updatedAt") SELECT 'au', "city", "courseType", "createdAt", "description", "endTime", "id", "imageUrl", "instructor", "isOnline", "isPublished", "location", "maxAttendees", "meetingUrl", "price", "registrationUrl", "slug", "startTime", "timezone", "title", "updatedAt" FROM "ScheduledCourse";
DROP TABLE "ScheduledCourse";
ALTER TABLE "new_ScheduledCourse" RENAME TO "ScheduledCourse";
CREATE UNIQUE INDEX "ScheduledCourse_tenantId_slug_key" ON "ScheduledCourse"("tenantId", "slug");
CREATE TABLE "new_TalkSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bio" TEXT,
    "city" TEXT,
    "slidesUrl" TEXT,
    "slidesFileName" TEXT,
    "slidesMimeType" TEXT,
    "slidesSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contentLocked" BOOLEAN NOT NULL DEFAULT false,
    "slidesLocked" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalkSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TalkSubmission" ("tenantId", "bio", "city", "contentLocked", "createdAt", "deletedAt", "description", "email", "id", "name", "slidesFileName", "slidesLocked", "slidesMimeType", "slidesSize", "slidesUrl", "status", "title", "updatedAt", "userId") SELECT 'au', "bio", "city", "contentLocked", "createdAt", "deletedAt", "description", "email", "id", "name", "slidesFileName", "slidesLocked", "slidesMimeType", "slidesSize", "slidesUrl", "status", "title", "updatedAt", "userId" FROM "TalkSubmission";
DROP TABLE "TalkSubmission";
ALTER TABLE "new_TalkSubmission" RENAME TO "TalkSubmission";
CREATE INDEX "TalkSubmission_tenantId_userId_idx" ON "TalkSubmission"("tenantId", "userId");
CREATE TABLE "new_TalkComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalkComment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TalkSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TalkComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TalkComment" ("tenantId", "authorId", "content", "createdAt", "id", "submissionId", "updatedAt") SELECT 'au', "authorId", "content", "createdAt", "id", "submissionId", "updatedAt" FROM "TalkComment";
DROP TABLE "TalkComment";
ALTER TABLE "new_TalkComment" RENAME TO "TalkComment";
CREATE INDEX "TalkComment_tenantId_submissionId_createdAt_idx" ON "TalkComment"("tenantId", "submissionId", "createdAt");
CREATE TABLE "new_SlideGeneratorState" (
    "scope" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("tenantId", "scope")
);
INSERT INTO "new_SlideGeneratorState" ("tenantId", "data", "scope", "updatedAt") SELECT 'au', "data", "scope", "updatedAt" FROM "SlideGeneratorState";
DROP TABLE "SlideGeneratorState";
ALTER TABLE "new_SlideGeneratorState" RENAME TO "SlideGeneratorState";
CREATE TABLE "new_SlideStylePreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SlideStylePreset" ("tenantId", "createdAt", "data", "id", "name", "updatedAt") SELECT 'au', "createdAt", "data", "id", "name", "updatedAt" FROM "SlideStylePreset";
DROP TABLE "SlideStylePreset";
ALTER TABLE "new_SlideStylePreset" RENAME TO "SlideStylePreset";
CREATE UNIQUE INDEX "SlideStylePreset_tenantId_name_key" ON "SlideStylePreset"("tenantId", "name");
CREATE TABLE "new_SlideRender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "sizeBytes" INTEGER NOT NULL,
    "renderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SlideRender" ("tenantId", "contentHash", "eventId", "id", "mimeType", "r2Key", "renderedAt", "sizeBytes", "slideId", "speakerId", "updatedAt") SELECT 'au', "contentHash", "eventId", "id", "mimeType", "r2Key", "renderedAt", "sizeBytes", "slideId", "speakerId", "updatedAt" FROM "SlideRender";
DROP TABLE "SlideRender";
ALTER TABLE "new_SlideRender" RENAME TO "SlideRender";
CREATE INDEX "SlideRender_tenantId_eventId_idx" ON "SlideRender"("tenantId", "eventId");
CREATE INDEX "SlideRender_tenantId_speakerId_idx" ON "SlideRender"("tenantId", "speakerId");
CREATE UNIQUE INDEX "SlideRender_tenantId_eventId_slideId_speakerId_key" ON "SlideRender"("tenantId", "eventId", "slideId", "speakerId");
CREATE TABLE "new_SlideExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "params" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "outputKind" TEXT,
    "outputR2Key" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SlideExportJob" ("tenantId", "completedCount", "createdAt", "errorMessage", "eventId", "id", "outputKind", "outputR2Key", "params", "status", "totalCount", "updatedAt", "userId") SELECT 'au', "completedCount", "createdAt", "errorMessage", "eventId", "id", "outputKind", "outputR2Key", "params", "status", "totalCount", "updatedAt", "userId" FROM "SlideExportJob";
DROP TABLE "SlideExportJob";
ALTER TABLE "new_SlideExportJob" RENAME TO "SlideExportJob";
CREATE INDEX "SlideExportJob_tenantId_eventId_createdAt_idx" ON "SlideExportJob"("tenantId", "eventId", "createdAt");
CREATE INDEX "SlideExportJob_tenantId_userId_idx" ON "SlideExportJob"("tenantId", "userId");
CREATE TABLE "new_SocialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL,
    "connector" TEXT NOT NULL DEFAULT 'linkedin',
    "accountType" TEXT NOT NULL DEFAULT 'organization',
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scopes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SocialAccount" ("tenantId", "accessToken", "accountType", "avatarUrl", "connector", "createdAt", "createdById", "displayName", "expiresAt", "externalId", "id", "platform", "refreshToken", "scopes", "updatedAt") SELECT 'au', "accessToken", "accountType", "avatarUrl", "connector", "createdAt", "createdById", "displayName", "expiresAt", "externalId", "id", "platform", "refreshToken", "scopes", "updatedAt" FROM "SocialAccount";
DROP TABLE "SocialAccount";
ALTER TABLE "new_SocialAccount" RENAME TO "SocialAccount";
CREATE INDEX "SocialAccount_tenantId_platform_idx" ON "SocialAccount"("tenantId", "platform");
CREATE INDEX "SocialAccount_tenantId_connector_idx" ON "SocialAccount"("tenantId", "connector");
CREATE UNIQUE INDEX "SocialAccount_tenantId_connector_externalId_key" ON "SocialAccount"("tenantId", "connector", "externalId");
CREATE TABLE "new_SocialPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "accountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'none',
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "errorMessage" TEXT,
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SocialPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SocialPost" ("tenantId", "accountId", "content", "createdAt", "createdById", "errorMessage", "externalId", "externalUrl", "id", "mediaType", "mediaUrls", "platform", "publishAttempts", "publishedAt", "scheduledAt", "status", "updatedAt") SELECT 'au', "accountId", "content", "createdAt", "createdById", "errorMessage", "externalId", "externalUrl", "id", "mediaType", "mediaUrls", "platform", "publishAttempts", "publishedAt", "scheduledAt", "status", "updatedAt" FROM "SocialPost";
DROP TABLE "SocialPost";
ALTER TABLE "new_SocialPost" RENAME TO "SocialPost";
CREATE INDEX "SocialPost_tenantId_status_scheduledAt_idx" ON "SocialPost"("tenantId", "status", "scheduledAt");
CREATE INDEX "SocialPost_tenantId_accountId_scheduledAt_idx" ON "SocialPost"("tenantId", "accountId", "scheduledAt");
CREATE INDEX "SocialPost_tenantId_platform_status_idx" ON "SocialPost"("tenantId", "platform", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSetting_tenantId_key" ON "TenantSetting"("tenantId");

-- CreateIndex
CREATE INDEX "UserTenant_tenantId_idx" ON "UserTenant"("tenantId");

-- CreateIndex
CREATE INDEX "UserTenant_userId_idx" ON "UserTenant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTenant_tenantId_userId_key" ON "UserTenant"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "PendingAdminGrant_tenantId_idx" ON "PendingAdminGrant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingAdminGrant_tenantId_email_key" ON "PendingAdminGrant"("tenantId", "email");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

