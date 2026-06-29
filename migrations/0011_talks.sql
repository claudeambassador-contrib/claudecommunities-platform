-- Rename SpeakerSubmission → TalkSubmission and expand it into a full
-- talk-submission workflow. Data-preserving migration: keeps existing
-- rows, renames `topic` → `title`, adds optional userId/description/
-- slides metadata, plus two independent lock flags. SQLite 3.25+ auto-
-- rewrites foreign-key references on rename, so Speaker.submissionId
-- and EventAgendaItem.submissionId stay valid without a rebuild.

PRAGMA foreign_keys=OFF;

-- 1. Rename the table itself
ALTER TABLE "SpeakerSubmission" RENAME TO "TalkSubmission";

-- 2. Rename the talk-title column
ALTER TABLE "TalkSubmission" RENAME COLUMN "topic" TO "title";

-- 3. Add new columns (all nullable or defaulted so existing rows stay valid)
ALTER TABLE "TalkSubmission" ADD COLUMN "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "TalkSubmission" ADD COLUMN "description" TEXT;
ALTER TABLE "TalkSubmission" ADD COLUMN "slidesUrl" TEXT;
ALTER TABLE "TalkSubmission" ADD COLUMN "slidesFileName" TEXT;
ALTER TABLE "TalkSubmission" ADD COLUMN "slidesMimeType" TEXT;
ALTER TABLE "TalkSubmission" ADD COLUMN "slidesSize" INTEGER;
ALTER TABLE "TalkSubmission" ADD COLUMN "contentLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TalkSubmission" ADD COLUMN "slidesLocked" BOOLEAN NOT NULL DEFAULT false;

-- 4. New comments thread (bi-directional: user ↔ admin)
CREATE TABLE "TalkComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalkComment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TalkSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TalkComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. Indexes
CREATE INDEX "TalkSubmission_userId_idx" ON "TalkSubmission"("userId");
CREATE INDEX "TalkComment_submissionId_createdAt_idx" ON "TalkComment"("submissionId", "createdAt");

PRAGMA foreign_keys=ON;
