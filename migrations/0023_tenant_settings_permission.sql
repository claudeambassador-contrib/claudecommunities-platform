-- Backfill the new `tenant.settings` permission onto existing system admin
-- roles across every tenant. Newly provisioned tenants get it automatically
-- (their roles seed from ALL_PERMISSIONS), but existing tenants store a frozen
-- JSON permission snapshot, so append it here. Idempotent: skips rows that
-- already contain it. `$[#]` appends to the end of the JSON array.
UPDATE "Role"
SET "permissions" = json_insert("permissions", '$[#]', 'tenant.settings')
WHERE "name" IN ('super_admin', 'admin')
  AND "permissions" LIKE '[%'
  AND "permissions" NOT LIKE '%"tenant.settings"%';
