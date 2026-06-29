/**
 * Consolidation pass after reassign-teams-final.ts.
 *
 * The first script moved PLACEHOLDER records (those with synthetic
 * @impactlab.local emails) but real check-ins (people who logged in with
 * their real email) stayed on their old teams, creating duplicates.
 *
 * This script:
 *   1. For each entry on the new roster, finds the REAL-email participant
 *      record by fuzzy name match and moves them to the target team.
 *   2. Then deletes placeholder records (synthetic @impactlab.local email)
 *      that duplicate a real record on the same team. Real records,
 *      session tokens, and coffee codes attached to real users are never
 *      touched.
 *   3. Mentors and judges are left alone, per the brief.
 *
 * Re-runnable safely.
 */
import prisma from "../src/lib/prisma";

const PLACEHOLDER_DOMAIN = '@impactlab.local'

type Row = { name: string; team: number }
const ROSTER: Row[] = [
  { name: 'Prosper Musukuma', team: 1 },
  { name: 'Anuj Pundalik', team: 1 },
  { name: 'Ryan Sinnott', team: 1 },
  { name: 'Darren Shandler', team: 1 },
  { name: 'Ishaan Kataria', team: 1 },
  { name: 'Abhilash Venkatesh', team: 1 },
  { name: 'Fithriyah Shalihah', team: 1 },
  { name: 'Paakhi Dodwani', team: 1 },
  { name: 'Gerard Roche', team: 18 },
  { name: 'Aashish Jolly', team: 18 },
  { name: 'Ryan Haque', team: 18 },
  { name: 'Santiago Perez', team: 18 },
  { name: 'Jack Thomas', team: 18 },
  { name: 'Alex Nguyen', team: 18 },
  { name: 'Steven Merriel', team: 5 },
  { name: 'Marco Meyer', team: 5 },
  { name: 'Matthew Bilo', team: 5 },
  { name: 'Karthik Murali', team: 5 },
  { name: 'Melanie Thewlis', team: 5 },
  { name: 'Hannah Moore', team: 5 },
  { name: 'Kyle Berkow', team: 5 },
  { name: 'Shaugato Paroi', team: 7 },
  { name: 'Daniel Bassett', team: 7 },
  { name: 'Nicholas Tchea', team: 7 },
  { name: 'Thiago Shimada Ramos', team: 7 },
  { name: 'Ravi Kumawat', team: 7 },
  { name: 'Ryan Vijay', team: 7 },
  { name: 'Tamara Fernandez', team: 8 },
  { name: 'Ali Shakeri', team: 12 },
  { name: 'Giorgio Liapakis', team: 12 },
  { name: 'Jasper Ellis', team: 12 },
  { name: 'Matthew Blode', team: 12 },
  { name: 'Stuart Sim', team: 12 },
  { name: 'Fiona Lai', team: 12 },
  { name: 'Jaime Orelowitz', team: 12 },
  { name: 'Ritesh Hiremath', team: 808 },
  { name: "Heather-Rain O'Neill", team: 808 },
  { name: 'Saumya Mutneja', team: 808 },
  { name: 'Kuldeep Jangid', team: 808 },
  { name: 'Sergey Iakovlev', team: 808 },
  { name: 'Vitaliy Baschlykoff', team: 808 },
  { name: 'Mikey Gayed', team: 808 },
  { name: 'Luke McManus', team: 808 },
  { name: 'Liam Ted Arbuckle', team: 2 },
  { name: 'Luke Stephenson', team: 2 },
  { name: 'Eden Xu', team: 2 },
  { name: 'Jahnavi Datla', team: 2 },
  { name: 'Dennis Wollersheim', team: 2 },
  { name: 'Tracy Anthony', team: 2 },
  { name: 'Sandy Buchanan', team: 2 },
  { name: 'Wing Lok Oliver Chan', team: 2 },
  { name: 'Trang Du', team: 2 },
  { name: 'Esther Nitafan', team: 2 },
  { name: 'Tim Lacey', team: 11 },
  { name: 'Matthew Piga', team: 11 },
  { name: 'Richard Fu', team: 11 },
  { name: 'Jodi English', team: 11 },
  { name: 'Blake Ryan', team: 11 },
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

function tokens(s: string): string[] {
  return norm(s).split(' ').filter(Boolean)
}

type P = {
  id: string
  name: string
  email: string
  role: string
  teamId: string | null
  isPlaceholder: boolean
}

function findRealMatch(inputName: string, realParts: P[]): P | null {
  const n = norm(inputName)
  const it = tokens(inputName)
  if (it.length === 0) return null
  const first = it[0]
  const last = it[it.length - 1]

  // 1. Exact (case/punctuation insensitive)
  const exact = realParts.filter((p) => norm(p.name) === n)
  if (exact.length >= 1) return exact[0]

  // 2. Both first + last contained anywhere in name
  if (it.length >= 2) {
    const both = realParts.filter((p) => {
      const pn = norm(p.name)
      return pn.includes(first) && pn.includes(last)
    })
    if (both.length === 1) return both[0]
  }

  // 3. First name exact + last-name 3-char prefix
  if (it.length >= 2) {
    const prefix = realParts.filter((p) => {
      const pt = tokens(p.name)
      if (pt.length < 2 || pt[0] !== first) return false
      return pt[pt.length - 1].slice(0, 3) === last.slice(0, 3)
    })
    if (prefix.length === 1) return prefix[0]
  }

  // 4. Single-token real record (someone typed only first name at check-in)
  const singleTok = realParts.filter((p) => {
    const pt = tokens(p.name)
    return pt.length === 1 && pt[0] === first
  })
  if (singleTok.length === 1) return singleTok[0]

  return null
}

async function ensureTeamId(n: number): Promise<string | null> {
  const t = await prisma.impactLabTeam.findUnique({
    where: { name: `Team ${n}` },
    select: { id: true },
  })
  return t?.id ?? null
}

async function main() {
  // Build a working set of all participants in memory
  const raw = await prisma.impactLabParticipant.findMany({
    select: { id: true, name: true, email: true, role: true, teamId: true },
  })
  const all: P[] = raw.map((p) => ({
    ...p,
    isPlaceholder: p.email.endsWith(PLACEHOLDER_DOMAIN),
  }))
  const realParts = all.filter(
    (p) => p.role === 'participant' && !p.isPlaceholder,
  )

  const teamIds = new Map<number, string>()
  for (const n of new Set(ROSTER.map((r) => r.team))) {
    const id = await ensureTeamId(n)
    if (id) teamIds.set(n, id)
  }

  const report = {
    moved: [] as string[],
    alreadyOnTeam: [] as string[],
    noRealMatch: [] as string[],
    skippedMentor: [] as string[],
    placeholdersDeleted: [] as string[],
  }

  // Pass 1: move real check-ins to assigned teams
  for (const row of ROSTER) {
    const targetTeamId = teamIds.get(row.team)
    if (!targetTeamId) continue

    // If a mentor/judge is already on the new list, skip
    const mentorMatch = all.find(
      (p) =>
        norm(p.name) === norm(row.name) &&
        (p.role === 'mentor' || p.role === 'judge'),
    )
    if (mentorMatch) {
      report.skippedMentor.push(`${row.name} (role=${mentorMatch.role})`)
      continue
    }

    const real = findRealMatch(row.name, realParts)
    if (!real) {
      report.noRealMatch.push(`${row.name} → Team ${row.team}`)
      continue
    }
    if (real.teamId === targetTeamId) {
      report.alreadyOnTeam.push(`${row.name} (real: ${real.name})`)
      continue
    }
    await prisma.impactLabParticipant.update({
      where: { id: real.id },
      data: { teamId: targetTeamId },
    })
    real.teamId = targetTeamId
    report.moved.push(
      `${row.name} → Team ${row.team}  (real: ${real.name} <${real.email}>)`,
    )
  }

  // Pass 2: delete placeholder records that duplicate a real record on the
  // SAME team. Keep placeholders that don't have a real twin yet.
  // Refresh in-memory state first.
  const refreshed = await prisma.impactLabParticipant.findMany({
    select: { id: true, name: true, email: true, role: true, teamId: true },
  })
  const byTeamAndName = new Map<string, { real: typeof refreshed; placeholder: typeof refreshed }>()
  for (const p of refreshed) {
    const key = `${p.teamId ?? 'none'}|${norm(p.name).split(' ')[0]}` // group by team + first-name token
    let bucket = byTeamAndName.get(key)
    if (!bucket) {
      bucket = { real: [], placeholder: [] }
      byTeamAndName.set(key, bucket)
    }
    if (p.email.endsWith(PLACEHOLDER_DOMAIN)) bucket.placeholder.push(p)
    else bucket.real.push(p)
  }
  for (const [, bucket] of byTeamAndName) {
    if (bucket.real.length === 0) continue
    // Build a set of normalized real names. Only delete placeholders whose
    // normalized name (or single-token variant) matches a real name.
    const realNorms = new Set(bucket.real.map((r) => norm(r.name)))
    const realFirsts = new Set(
      bucket.real.map((r) => norm(r.name).split(' ')[0]),
    )
    for (const ph of bucket.placeholder) {
      if (ph.role !== 'participant') continue
      const phNorm = norm(ph.name)
      const phFirst = phNorm.split(' ')[0]
      const dup =
        realNorms.has(phNorm) ||
        (phNorm.split(' ').length === 1 && realFirsts.has(phFirst))
      if (!dup) continue
      // The placeholder has a coffee pool entry — null it out before delete
      // so the pool row goes back to unassigned.
      await prisma.impactLabCoffeeCode
        .updateMany({
          where: { participantId: ph.id },
          data: { participantId: null },
        })
      await prisma.impactLabParticipant.delete({ where: { id: ph.id } })
      report.placeholdersDeleted.push(`${ph.name} <${ph.email}>`)
    }
  }

  console.log('\n=== Consolidation Report ===\n')
  console.log(`✓ Real check-ins moved to new team   : ${report.moved.length}`)
  for (const l of report.moved) console.log('   ' + l)
  console.log(`= Real check-in already on team      : ${report.alreadyOnTeam.length}`)
  for (const l of report.alreadyOnTeam) console.log('   ' + l)
  console.log(`◌ No real check-in found yet         : ${report.noRealMatch.length}`)
  for (const l of report.noRealMatch) console.log('   ' + l)
  console.log(`⨯ Skipped (mentor/judge)             : ${report.skippedMentor.length}`)
  for (const l of report.skippedMentor) console.log('   ' + l)
  console.log(`✚ Placeholder duplicates deleted     : ${report.placeholdersDeleted.length}`)
  for (const l of report.placeholdersDeleted) console.log('   ' + l)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
