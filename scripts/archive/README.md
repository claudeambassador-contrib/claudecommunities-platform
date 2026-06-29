# Archived one-off scripts

Historical, already-run scripts kept for reference: data backfills, duplicate
cleanups (team rosters, placeholders, "rye" fixes), diagnostic probes, and
course-content seeds/rewrites superseded by `prisma/seed.ts`.

None of these are referenced by `package.json`, CI, or the app. They target
data states (and in `update-rye.cjs`'s case, the old Postgres/Neon database —
its `pg` dependency has been removed) that no longer exist, so expect them to
need edits before they would run again. Prefer writing a fresh script over
resurrecting one of these.
