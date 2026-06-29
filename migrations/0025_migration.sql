-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateFull" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isCapital" BOOLEAN NOT NULL DEFAULT false,
    "keywords" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "City_tenantId_slug_key" ON "City"("tenantId", "slug");

