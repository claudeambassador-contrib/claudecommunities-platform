-- CreateTable
CREATE TABLE "ImpactLabTeamVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactLabTeamVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ImpactLabParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImpactLabTeamVote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ImpactLabTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImpactLabConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'config',
    "eventName" TEXT NOT NULL DEFAULT 'Claude Impact Lab',
    "eventTagline" TEXT NOT NULL DEFAULT 'Build AI for your city — in a day.',
    "eventDate" TEXT NOT NULL DEFAULT '23 May 2026',
    "accessCode" TEXT NOT NULL DEFAULT 'IMPACTLAB',
    "adminPassword" TEXT NOT NULL DEFAULT 'hackday-admin',
    "adminToken" TEXT,
    "checkInOpen" BOOLEAN NOT NULL DEFAULT true,
    "votingOpen" BOOLEAN NOT NULL DEFAULT false,
    "winningStatementId" TEXT,
    "peoplesChoiceOpen" BOOLEAN NOT NULL DEFAULT false,
    "peoplesChoiceWinnerTeamId" TEXT,
    "coffeeNote" TEXT NOT NULL DEFAULT 'Show this code at the coffee cart to claim your cup. One redemption per person.',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ImpactLabConfig" ("accessCode", "adminPassword", "adminToken", "checkInOpen", "coffeeNote", "eventDate", "eventName", "eventTagline", "id", "updatedAt", "votingOpen", "winningStatementId") SELECT "accessCode", "adminPassword", "adminToken", "checkInOpen", "coffeeNote", "eventDate", "eventName", "eventTagline", "id", "updatedAt", "votingOpen", "winningStatementId" FROM "ImpactLabConfig";
DROP TABLE "ImpactLabConfig";
ALTER TABLE "new_ImpactLabConfig" RENAME TO "ImpactLabConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabTeamVote_participantId_key" ON "ImpactLabTeamVote"("participantId");

-- CreateIndex
CREATE INDEX "ImpactLabTeamVote_teamId_idx" ON "ImpactLabTeamVote"("teamId");

