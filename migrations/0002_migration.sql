-- CreateTable
CREATE TABLE "EventAgendaItem" (
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
    "submissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventAgendaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventAgendaItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SpeakerSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("city", "createdAt", "description", "endTime", "eventType", "id", "imageUrl", "isOnline", "location", "lumaEventId", "lumaUrl", "maxAttendees", "meetingUrl", "rsvpEnabled", "slug", "startTime", "timezone", "title", "updatedAt") SELECT "city", "createdAt", "description", "endTime", "eventType", "id", "imageUrl", "isOnline", "location", "lumaEventId", "lumaUrl", "maxAttendees", "meetingUrl", "rsvpEnabled", "slug", "startTime", "timezone", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventAgendaItem_eventId_order_idx" ON "EventAgendaItem"("eventId", "order");

