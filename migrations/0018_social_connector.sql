-- Add `connector` column to SocialAccount so multiple connectors can target
-- the same destination platform. Existing rows are direct LinkedIn OAuth,
-- so we default to 'linkedin'. The previous (platform, externalId) unique
-- constraint is replaced by (connector, externalId) — a destination platform
-- can be reached through multiple connectors.

-- SQLite can't drop/replace a unique constraint in-place; we have to
-- rebuild the table.

PRAGMA foreign_keys=OFF;

CREATE TABLE "SocialAccount_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

INSERT INTO "SocialAccount_new" (
    "id", "platform", "connector", "accountType", "externalId", "displayName",
    "avatarUrl", "accessToken", "refreshToken", "expiresAt", "scopes",
    "createdById", "createdAt", "updatedAt"
)
SELECT
    "id", "platform", 'linkedin', "accountType", "externalId", "displayName",
    "avatarUrl", "accessToken", "refreshToken", "expiresAt", "scopes",
    "createdById", "createdAt", "updatedAt"
FROM "SocialAccount";

DROP TABLE "SocialAccount";
ALTER TABLE "SocialAccount_new" RENAME TO "SocialAccount";

CREATE INDEX "SocialAccount_platform_idx" ON "SocialAccount"("platform");
CREATE INDEX "SocialAccount_connector_idx" ON "SocialAccount"("connector");
CREATE UNIQUE INDEX "SocialAccount_connector_externalId_key" ON "SocialAccount"("connector", "externalId");

PRAGMA foreign_keys=ON;
