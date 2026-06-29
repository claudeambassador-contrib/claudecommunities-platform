/**
 * One-off backfill: sync community Users into the Send16 "Claude Community"
 * workspace as contacts (via POST /api/contacts/upsert).
 *
 * DRY-RUN BY DEFAULT — prints what it would do and changes nothing. Pass
 * `--commit` to actually upsert. `--limit N` caps the number processed.
 *
 *   tsx scripts/sync-users-to-send16.ts            # dry run
 *   tsx scripts/sync-users-to-send16.ts --commit   # live upsert
 *
 * Requires (for --commit):
 *   SEND16_API_KEY   sk_live_ key for the Claude Community workspace
 *   SEND16_BASE_URL  optional, defaults to https://api.send16.com
 *
 * Skips users with no email and banned users. Idempotent — re-running merges
 * (upsert), so it's safe to run repeatedly. Ongoing sync (new signups) should
 * later hang off the Clerk user.created webhook; this script seeds history.
 *
 * NOTE: granular EmailPreference → Send16 subscription-topic mapping is a
 * deliberate follow-up; this backfill seeds the audience with core fields.
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";

const COMMIT = process.argv.includes("--commit");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const SEND16_BASE_URL = process.env.SEND16_BASE_URL ?? "https://api.send16.com";
const SEND16_API_KEY = process.env.SEND16_API_KEY;

interface UpsertResult { created: number; updated: number; failed: number; skipped: number }

async function upsertContact(user: {
  id: string;
  email: string;
  name: string | null;
  city: string | null;
  role: string;
  importSource: string | null;
}): Promise<"created" | "updated" | "failed"> {
  const res = await fetch(`${SEND16_BASE_URL}/api/contacts/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SEND16_API_KEY}`,
      "X-Send16-Source": "community-sync",
    },
    body: JSON.stringify({
      email: user.email,
      name: user.name ?? undefined,
      properties: {
        source: "community-sync",
        communityUserId: user.id,
        city: user.city ?? undefined,
        role: user.role,
        importSource: user.importSource ?? undefined,
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    created?: boolean;
    error?: { code?: string; message?: string };
  };

  if (!res.ok || body.success === false) {
    const code = body.error?.code ?? `HTTP_${res.status}`;
    if (code === "LIMIT_EXCEEDED") {
      throw new Error("Send16 contact limit reached — upgrade the workspace plan, then re-run.");
    }
    console.error(`  ✗ ${user.email}: ${body.error?.message ?? code}`);
    return "failed";
  }
  return body.created ? "created" : "updated";
}

async function main() {
  if (COMMIT && !SEND16_API_KEY) {
    console.error("SEND16_API_KEY is required for --commit. Aborting.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { email: { not: null }, isBanned: false },
    select: { id: true, email: true, name: true, city: true, role: true, importSource: true },
    take: LIMIT,
    orderBy: { lastSeen: "desc" },
  });

  console.log(
    `${COMMIT ? "LIVE" : "DRY-RUN"}: ${users.length} eligible users → Send16 (${SEND16_BASE_URL})`,
  );
  if (!COMMIT) {
    for (const u of users.slice(0, 10)) {
      console.log(`  would upsert: ${u.email}  (${u.name ?? "—"}, ${u.city ?? "no city"}, ${u.role})`);
    }
    if (users.length > 10) console.log(`  …and ${users.length - 10} more`);
    console.log("\nRe-run with --commit to apply.");
    return;
  }

  const stats: UpsertResult = { created: 0, updated: 0, failed: 0, skipped: 0 };
  let i = 0;
  for (const u of users) {
    i++;
    // `email` is non-null by the query filter, but Prisma types it nullable.
    if (!u.email) { stats.skipped++; continue; }
    const outcome = await upsertContact({ ...u, email: u.email });
    stats[outcome]++;
    if (i % 50 === 0) console.log(`  …${i}/${users.length} (${stats.created} new, ${stats.updated} updated)`);
    await new Promise((r) => setTimeout(r, 100)); // gentle throttle
  }

  console.log(
    `\nDone: ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed, ${stats.skipped} skipped.`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
