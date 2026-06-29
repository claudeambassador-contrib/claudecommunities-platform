/**
 * Delete leftover placeholder participants:
 *   - placeholder = email ends in @impactlab.local
 *   - role = participant (mentors/judges never touched)
 *   - AND either:
 *       (a) name doesn't match anyone on the final event sheet, OR
 *       (b) a real-email twin already exists for this person (duplicate)
 *
 * Real records, session tokens, mentors and judges are NEVER touched.
 * Each deleted placeholder's coffee-pool code is released back to the
 * unassigned pool.
 *
 * Default mode is DRY-RUN: prints what would be deleted and exits.
 * Pass --commit to actually delete.
 */
import prisma from "../src/lib/prisma";

const PLACEHOLDER_DOMAIN = '@impactlab.local'

const SHEET_ROSTER = [
  'Prosper Musukuma', 'Anuj Pundalik', 'Ryan Sinnott', 'Darren Shandler',
  'Ishaan Kataria', 'Abhilash Venkatesh', 'Fithriyah Shalihah', 'Paakhi Dodwani',
  'Gerard Roche', 'Aashish Jolly', 'Ryan Haque', 'Santiago Perez',
  'Jack Thomas', 'Alex Nguyen',
  'Steven Merriel', 'Marco Meyer', 'Matthew Bilo', 'Karthik Murali',
  'Melanie Thewlis', 'Hannah Moore', 'Kyle Berkow',
  'Shaugato Paroi', 'Daniel Bassett', 'Nicholas Tchea',
  'Thiago Shimada Ramos', 'Ravi Kumawat', 'Ryan Vijay',
  'Tamara Fernandez',
  'Ali Shakeri', 'Giorgio Liapakis', 'Jasper Ellis', 'Matthew Blode',
  'Stuart Sim', 'Fiona Lai', 'Jaime Orelowitz',
  'Ritesh Hiremath', "Heather-Rain O'Neill", 'Saumya Mutneja', 'Kuldeep Jangid',
  'Sergey Iakovlev', 'Vitaliy Baschlykoff', 'Mikey Gayed', 'Luke McManus',
  'Liam Ted Arbuckle', 'Luke Stephenson', 'Eden Xu', 'Jahnavi Datla',
  'Dennis Wollersheim', 'Tracy Anthony', 'Sandy Buchanan',
  'Wing Lok Oliver Chan', 'Trang Du', 'Esther Nitafan',
  'Tim Lacey', 'Matthew Piga', 'Richard Fu', 'Jodi English', 'Blake Ryan',
]

function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function firstToken(s: string): string {
  return norm(s).split(' ')[0] ?? ''
}

const SHEET_NORMS = new Set(SHEET_ROSTER.map((n) => norm(n)))
const SHEET_FIRSTS = new Set(SHEET_ROSTER.map((n) => firstToken(n)))

type P = {
  id: string
  name: string
  email: string
  role: string
  teamId: string | null
  team?: { name: string } | null
}

function onSheet(name: string): boolean {
  const n = norm(name)
  if (SHEET_NORMS.has(n)) return true
  // Allow fuzzy single-token match (placeholder "Fithriyah Shalihah" maps to
  // a sheet name; we want to detect that — already covered by exact norm).
  // Single-token placeholders aren't in the sheet (sheet always has first+last),
  // so no extra rule needed here.
  return false
}

function hasRealTwinOnSameTeam(
  ph: P,
  all: P[],
): { exists: boolean; twin?: P } {
  if (!ph.teamId) return { exists: false }
  const phFirst = firstToken(ph.name)
  const candidates = all.filter(
    (p) =>
      p.id !== ph.id &&
      p.teamId === ph.teamId &&
      p.role === 'participant' &&
      !p.email.endsWith(PLACEHOLDER_DOMAIN) &&
      firstToken(p.name) === phFirst,
  )
  return candidates.length > 0
    ? { exists: true, twin: candidates[0] }
    : { exists: false }
}

async function main() {
  const commit = process.argv.includes('--commit')
  const all = (await prisma.impactLabParticipant.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      team: { select: { name: true } },
    },
  })) as P[]

  type Plan = { p: P; reason: string }
  const toDelete: Plan[] = []
  const keep: { p: P; reason: string }[] = []

  for (const p of all) {
    if (p.role !== 'participant') continue
    if (!p.email.endsWith(PLACEHOLDER_DOMAIN)) continue

    const inSheet = onSheet(p.name)
    const twinInfo = hasRealTwinOnSameTeam(p, all)

    if (twinInfo.exists) {
      toDelete.push({
        p,
        reason: `duplicate — real twin "${twinInfo.twin!.name}" <${twinInfo.twin!.email}> on same team`,
      })
    } else if (!inSheet) {
      toDelete.push({ p, reason: 'not on final event sheet' })
    } else {
      keep.push({ p, reason: 'on sheet, no real check-in yet' })
    }
  }

  console.log(
    `\n${commit ? 'DELETING' : '[DRY-RUN] Would delete'} ${toDelete.length} placeholder(s):\n`,
  )
  for (const { p, reason } of toDelete) {
    console.log(
      `  ${commit ? '✚' : '·'} ${p.name.padEnd(28)} ${(p.team?.name ?? 'no team').padEnd(10)}  ${reason}`,
    )
  }
  console.log(`\nKeeping ${keep.length} placeholder(s) — on sheet, awaiting real check-in:\n`)
  for (const { p } of keep) {
    console.log(`  · ${p.name.padEnd(28)} ${p.team?.name ?? 'no team'}`)
  }

  if (!commit) {
    console.log('\nRe-run with --commit to actually delete.')
    return
  }

  for (const { p } of toDelete) {
    // Release any pool code first so it returns to the unassigned tail
    await prisma.impactLabCoffeeCode.updateMany({
      where: { participantId: p.id },
      data: { participantId: null },
    })
    await prisma.impactLabParticipant.delete({ where: { id: p.id } })
  }
  console.log(`\nDone. Deleted ${toDelete.length}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
