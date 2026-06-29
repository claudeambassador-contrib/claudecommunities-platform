-- CreateTable
CREATE TABLE "Role" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Seed system roles. The full permission list is hardcoded here on purpose
-- so existing admins keep all access on deploy, regardless of any future
-- changes to the registry in src/lib/permissions.ts.
INSERT INTO "Role" ("name", "description", "permissions", "isSystem", "createdAt", "updatedAt") VALUES
  (
    'super_admin',
    'Full access to every admin function, including role management. Cannot be deleted or edited.',
    '["users.view","users.edit","users.delete","users.assign_role","users.import","users.invite","users.sync","posts.view","posts.edit","posts.delete","badges.view","badges.edit","badges.delete","courses.view","courses.edit","courses.delete","events.view","events.edit","events.delete","email.view","email.edit","email.send","email.delete","email.settings","tiers.view","tiers.edit","tiers.delete","speakers.view","speakers.edit","speakers.delete","analytics.view","tools.use","social.view","social.edit","social.publish","social.manage","roles.view","roles.edit","roles.delete"]',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'admin',
    'Legacy admin role — grants every permission. Kept for backwards compatibility with existing role===''admin'' users.',
    '["users.view","users.edit","users.delete","users.assign_role","users.import","users.invite","users.sync","posts.view","posts.edit","posts.delete","badges.view","badges.edit","badges.delete","courses.view","courses.edit","courses.delete","events.view","events.edit","events.delete","email.view","email.edit","email.send","email.delete","email.settings","tiers.view","tiers.edit","tiers.delete","speakers.view","speakers.edit","speakers.delete","analytics.view","tools.use","social.view","social.edit","social.publish","social.manage","roles.view","roles.edit","roles.delete"]',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'member',
    'Default role for community members. No admin permissions.',
    '[]',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
