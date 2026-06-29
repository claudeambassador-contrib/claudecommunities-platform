/**
 * Final cleanup: delete placeholder participants (email ends in
 * @impactlab.local) that are obviously the same person as a real
 * check-in on the same team.
 *
 * Rule (deliberately conservative): on each team, group by first-name
 * token. If exactly ONE real record exists in a group, every placeholder
 * in that same group is treated as the same person and deleted.
 *
 *   - Real records, sessions, coffee codes are NEVER touched.
 *   - If a team has two real check-ins sharing a first name, that group
 *     is skipped (ambiguous — needs human eyes).
 *   - If a team has only placeholders with a given first name, they're
 *     kept (still useful — represents an expected attendee).
 *
 * Re-runnable safely.
 */
import prisma from "../src/lib/prisma";

const PLACEHOLDER_DOMAIN = '@impactlab.local'

function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const all = await prisma.impactLabParticipant.findMany({
    select: { id: true, name: true, email: true, role: true, teamId: true },
  })

  // Group by `${teamId}|${firstNameToken}` — placeholders that share a
  // team and first-name token with a single real participant are
  // assumed to be that same person.
  type Bucket = {
    real: typeof all
    placeholder: typeof all
  }
  const groups = new Map<string, Bucket>()
  for (const p of all) {
    if (p.role !== 'participant') continue
    if (!p.teamId) continue // Don't auto-merge unassigned — too risky
    const first = norm(p.name).split(' ')[0]
    if (!first) continue
    const key = `${p.teamId}|${first}`
    let b = groups.get(key)
    if (!b) {
      b = { real: [], placeholder: [] }
      groups.set(key, b)
    }
    if (p.email.endsWith(PLACEHOLDER_DOMAIN)) b.placeholder.push(p)
    else b.real.push(p)
  }

  const deleted: string[] = []
  const ambiguous: string[] = []

  for (const [key, b] of groups) {
    if (b.placeholder.length === 0) continue
    if (b.real.length === 0) continue
    if (b.real.length > 1) {
      ambiguous.push(
        `${key}: ${b.real.length} real records [${b.real.map((r) => r.name).join(', ')}] + ${b.placeholder.length} placeholder(s) — skipped`,
      )
      continue
    }
    // Exactly one real → delete the placeholder(s)
    for (const ph of b.placeholder) {
      // Release the pool code first so it goes back to unassigned
      await prisma.impactLabCoffeeCode.updateMany({
        where: { participantId: ph.id },
        data: { participantId: null },
      })
      await prisma.impactLabParticipant.delete({ where: { id: ph.id } })
      deleted.push(
        `${ph.name} <${ph.email}>  (real twin: ${b.real[0].name} <${b.real[0].email}>)`,
      )
    }
  }

  console.log(`\n✚ Deleted ${deleted.length} placeholder duplicate(s):`)
  for (const d of deleted) console.log('   ' + d)
  if (ambiguous.length > 0) {
    console.log(`\n? Skipped ${ambiguous.length} ambiguous group(s):`)
    for (const a of ambiguous) console.log('   ' + a)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
