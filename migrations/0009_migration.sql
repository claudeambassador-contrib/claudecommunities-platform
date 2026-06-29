-- CreateTable
CREATE TABLE "ImpactLabConfig" (
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
    "coffeeNote" TEXT NOT NULL DEFAULT 'Show this code at the coffee cart to claim your cup. One redemption per person.',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImpactLabTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#D4836A',
    "tableNumber" TEXT,
    "conceptTitle" TEXT,
    "conceptSummary" TEXT,
    "conceptSubmittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImpactLabParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "teamId" TEXT,
    "coffeeCode" TEXT NOT NULL,
    "coffeeRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "coffeeRedeemedAt" DATETIME,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" DATETIME,
    "sessionToken" TEXT,
    "preRegistered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImpactLabParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ImpactLabTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpactLabCoffeeCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "participantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactLabCoffeeCode_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ImpactLabParticipant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpactLabProblemStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImpactLabVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactLabVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ImpactLabParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImpactLabVote_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ImpactLabProblemStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpactLabScheduleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "track" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ImpactLabResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabTeam_name_key" ON "ImpactLabTeam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabParticipant_email_key" ON "ImpactLabParticipant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabParticipant_coffeeCode_key" ON "ImpactLabParticipant"("coffeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabParticipant_sessionToken_key" ON "ImpactLabParticipant"("sessionToken");

-- CreateIndex
CREATE INDEX "ImpactLabParticipant_teamId_idx" ON "ImpactLabParticipant"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabCoffeeCode_code_key" ON "ImpactLabCoffeeCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabCoffeeCode_order_key" ON "ImpactLabCoffeeCode"("order");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabCoffeeCode_participantId_key" ON "ImpactLabCoffeeCode"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLabVote_participantId_key" ON "ImpactLabVote"("participantId");

-- CreateIndex
CREATE INDEX "ImpactLabVote_statementId_idx" ON "ImpactLabVote"("statementId");

