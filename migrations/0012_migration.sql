-- CreateTable
CREATE TABLE "SlideExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateIndex
CREATE INDEX "SlideExportJob_eventId_createdAt_idx" ON "SlideExportJob"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "SlideExportJob_userId_idx" ON "SlideExportJob"("userId");

