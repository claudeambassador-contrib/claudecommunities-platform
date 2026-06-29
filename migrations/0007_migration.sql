-- CreateTable
CREATE TABLE "Speaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "bio" TEXT,
    "talkTitle" TEXT,
    "talkDescription" TEXT,
    "headshotUrl" TEXT,
    "companyLogoUrl" TEXT,
    "twitterHandle" TEXT,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "submissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Speaker_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Speaker_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SpeakerSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventAgendaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "title" TEXT,
    "description" TEXT,
    "speakerName" TEXT,
    "speakerBio" TEXT,
    "speakerPhotoUrl" TEXT,
    "speakerId" TEXT,
    "submissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventAgendaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventAgendaItem_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventAgendaItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SpeakerSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EventAgendaItem" ("createdAt", "description", "endTime", "eventId", "id", "order", "speakerBio", "speakerName", "speakerPhotoUrl", "startTime", "submissionId", "title", "type", "updatedAt") SELECT "createdAt", "description", "endTime", "eventId", "id", "order", "speakerBio", "speakerName", "speakerPhotoUrl", "startTime", "submissionId", "title", "type", "updatedAt" FROM "EventAgendaItem";
DROP TABLE "EventAgendaItem";
ALTER TABLE "new_EventAgendaItem" RENAME TO "EventAgendaItem";
CREATE INDEX "EventAgendaItem_eventId_order_idx" ON "EventAgendaItem"("eventId", "order");
CREATE INDEX "EventAgendaItem_speakerId_idx" ON "EventAgendaItem"("speakerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Speaker_eventId_order_idx" ON "Speaker"("eventId", "order");

