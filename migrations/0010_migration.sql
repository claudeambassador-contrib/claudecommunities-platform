-- CreateTable
CREATE TABLE "SlideRender" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateIndex
CREATE INDEX "SlideRender_eventId_idx" ON "SlideRender"("eventId");

-- CreateIndex
CREATE INDEX "SlideRender_speakerId_idx" ON "SlideRender"("speakerId");

-- CreateIndex
CREATE UNIQUE INDEX "SlideRender_eventId_slideId_speakerId_key" ON "SlideRender"("eventId", "slideId", "speakerId");

