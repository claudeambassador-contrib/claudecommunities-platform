/**
 * Final team reassignment for the Impact Lab event.
 *
 * Safe to re-run. Does NOT touch participant emails, session tokens, or
 * coffee codes — only teamId (and name, when a fuller spelling is given).
 * Mentors and judges are skipped per the organiser's request.
 *
 * - For each input row, fuzzy-match against existing participants.
 *   Match priority: exact (case-insensitive) → both first+last name
 *   contained → first name exact + last name 3-char prefix → single-token
 *   first-name-only match.
 * - If matched and role === 'participant' → update teamId.
 * - If matched and role is mentor/judge → skip and log.
 * - If unmatched → create as a new participant with placeholder email,
 *   claiming the next code from the coffee-code pool.
 *
 * Run with:  bun scripts/reassign-teams-final.ts
 */
import prisma from "../src/lib/prisma";
import { createParticipantWithPoolCode, randomTeamColor } from "../src/lib/services/impactLab";

type Row = { name: string; team: number }

const ROSTER: Row[] = [
  // Team 1
  { name: 'Prosper Musukuma', team: 1 },
  { name: 'Anuj Pundalik', team: 1 },
  { name: 'Ryan Sinnott', team: 1 },
  { name: 'Darren Shandler', team: 1 },
  { name: 'Ishaan Kataria', team: 1 },
  { name: 'Abhilash Venkatesh', team: 1 },
  { name: 'Fithriyah Shalihah', team: 1 },
  { name: 'Paakhi Dodwani', team: 1 },
  // Team 18
  { name: 'Gerard Roche', team: 18 },
  { name: 'Aashish Jolly', team: 18 },
  { name: 'Ryan Haque', team: 18 },
  { name: 'Santiago Perez', team: 18 },
  { name: 'Jack Thomas', team: 18 },
  { name: 'Alex Nguyen', team: 18 },
  // Team 5
  { name: 'Steven Merriel', team: 5 },
  { name: 'Marco Meyer', team: 5 },
  { name: 'Matthew Bilo', team: 5 },
  { name: 'Karthik Murali', team: 5 },
  { name: 'Melanie Thewlis', team: 5 },
  { name: 'Hannah Moore', team: 5 },
  { name: 'Kyle Berkow', team: 5 },
  // Team 7
  { name: 'Shaugato Paroi', team: 7 },
  { name: 'Daniel Bassett', team: 7 },
  { name: 'Nicholas Tchea', team: 7 },
  { name: 'Thiago Shimada Ramos', team: 7 },
  { name: 'Ravi Kumawat', team: 7 },
  { name: 'Ryan Vijay', team: 7 },
  // Team 8
  { name: 'Tamara Fernandez', team: 8 },
  // Team 12
  { name: 'Ali Shakeri', team: 12 },
  { name: 'Giorgio Liapakis', team: 12 },
  { name: 'Jasper Ellis', team: 12 },
  { name: 'Matthew Blode', team: 12 },
  { name: 'Stuart Sim', team: 12 },
  { name: 'Fiona Lai', team: 12 },
  { name: 'Jaime Orelowitz', team: 12 },
  // Team 808
  { name: 'Ritesh Hiremath', team: 808 },
  { name: "Heather-Rain O'Neill", team: 808 },
  { name: 'Saumya Mutneja', team: 808 },
  { name: 'Kuldeep Jangid', team: 808 },
  { name: 'Sergey Iakovlev', team: 808 },
  { name: 'Vitaliy Baschlykoff', team: 808 },
  { name: 'Mikey Gayed', team: 808 },
  { name: 'Luke McManus', team: 808 },
  // Team 2
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
  // Team 11
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

function nameTokens(s: string): string[] {
  return norm(s).split(' ').filter(Boolean)
}

type DBParticipant = {
  id: string
  name: string
  email: string
  role: string
  teamId: string | null
}

function findMatch(inputName: string, all: DBParticipant[]): DBParticipant | null {
  const n = norm(inputName)
  const it = nameTokens(inputName)
  if (it.length === 0) return null

  // Always prefer participant-role matches over mentor/judge so we don't
  // accidentally try to update Tracy Anthony's mentor record when there's
  // a Team-2 participant record by the same name.
  const sortRolePref = (a: DBParticipant, b: DBParticipant) =>
    (a.role === 'participant' ? 0 : 1) - (b.role === 'participant' ? 0 : 1)

  // 1. Exact case-insensitive whole-name match
  const exact = all.filter((p) => norm(p.name) === n).sort(sortRolePref)
  if (exact.length >= 1) return exact[0]

  // 2. Both first and last tokens contained
  const first = it[0]
  const last = it[it.length - 1]
  const bothContained = all
    .filter((p) => {
      const pn = norm(p.name)
      return pn.includes(first) && (it.length === 1 || pn.includes(last))
    })
    .sort(sortRolePref)
  if (bothContained.length === 1) return bothContained[0]

  // 3. First name exact + last name first-3-char prefix
  const prefix = all
    .filter((p) => {
      const pt = nameTokens(p.name)
      if (pt.length === 0 || pt[0] !== first) return false
      if (it.length === 1) return true
      const plast = pt[pt.length - 1]
      return plast.slice(0, 3) === last.slice(0, 3)
    })
    .sort(sortRolePref)
  if (prefix.length === 1) return prefix[0]

  // 4. Single-token candidate (like "Eden" or "Darren") whose only token
  //    matches the input's first name.
  const singleTok = all
    .filter((p) => {
      const pt = nameTokens(p.name)
      return pt.length === 1 && pt[0] === first
    })
    .sort(sortRolePref)
  if (singleTok.length === 1) return singleTok[0]

  // 5. Last-ditch: if `bothContained` has multiple, prefer participant role
  if (bothContained.length > 1) return bothContained[0]

  return null
}

async function ensureTeam(n: number): Promise<string> {
  const name = `Team ${n}`
  const existing = await prisma.impactLabTeam.findUnique({ where: { name } })
  if (existing) {
    if (!existing.tableNumber) {
      await prisma.impactLabTeam.update({
        where: { id: existing.id },
        data: { tableNumber: String(n) },
      })
    }
    return existing.id
  }
  const team = await prisma.impactLabTeam.create({
    data: { name, color: randomTeamColor(), tableNumber: String(n) },
  })
  console.log(`  ✚ created team "${name}" (table ${n})`)
  return team.id
}

function placeholderEmail(name: string, team: number): string {
  const slug = norm(name).replace(/\s+/g, '-') || 'participant'
  return `${slug}-t${team}@impactlab.local`
}

async function main() {
  console.log(`Reassigning ${ROSTER.length} participants…\n`)

  // Ensure all target teams exist up front
  const teamIds = new Map<number, string>()
  const targetTeams = Array.from(new Set(ROSTER.map((r) => r.team))).sort(
    (a, b) => a - b,
  )
  for (const n of targetTeams) {
    teamIds.set(n, await ensureTeam(n))
  }
  console.log(`Teams ready: ${targetTeams.join(', ')}\n`)

  const all = (await prisma.impactLabParticipant.findMany({
    select: { id: true, name: true, email: true, role: true, teamId: true },
  })) as DBParticipant[]

  const report = {
    moved: [] as string[],
    alreadyOnTeam: [] as string[],
    skippedMentorJudge: [] as string[],
    created: [] as string[],
    failed: [] as string[],
  }

  for (const row of ROSTER) {
    const targetTeamId = teamIds.get(row.team)
    if (!targetTeamId) {
      report.failed.push(`${row.name} → Team ${row.team} (no team id)`)
      continue
    }
    const match = findMatch(row.name, all)
    if (match) {
      if (match.role !== 'participant') {
        report.skippedMentorJudge.push(
          `${row.name} → Team ${row.team}  (matched ${match.name}, role=${match.role})`,
        )
        continue
      }
      if (match.teamId === targetTeamId) {
        report.alreadyOnTeam.push(`${row.name} → Team ${row.team}`)
        continue
      }
      await prisma.impactLabParticipant.update({
        where: { id: match.id },
        data: { teamId: targetTeamId },
      })
      // Update name to the fuller form if input is longer (e.g. "Darren" → "Darren Shandler")
      if (row.name.trim().length > match.name.trim().length) {
        await prisma.impactLabParticipant.update({
          where: { id: match.id },
          data: { name: row.name.trim() },
        })
      }
      // Update local cache so subsequent rows see the new state
      match.teamId = targetTeamId
      report.moved.push(
        `${row.name} → Team ${row.team}  (matched ${match.name})`,
      )
      continue
    }
    // No match — create new participant with placeholder email
    try {
      const created = await createParticipantWithPoolCode({
        name: row.name,
        email: placeholderEmail(row.name, row.team),
        role: 'participant',
        teamId: targetTeamId,
        preRegistered: true,
      })
      all.push({
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        teamId: created.teamId,
      })
      report.created.push(`${row.name} → Team ${row.team}`)
    } catch (e) {
      report.failed.push(`${row.name} → Team ${row.team}  (${(e as Error).message})`)
    }
  }

  console.log('\n=== Report ===\n')
  console.log(`✓ Moved to new team       : ${report.moved.length}`)
  for (const line of report.moved) console.log('   ' + line)
  console.log(`= Already on target team  : ${report.alreadyOnTeam.length}`)
  for (const line of report.alreadyOnTeam) console.log('   ' + line)
  console.log(`✚ Created (no match found): ${report.created.length}`)
  for (const line of report.created) console.log('   ' + line)
  console.log(`⨯ Skipped (mentor/judge)  : ${report.skippedMentorJudge.length}`)
  for (const line of report.skippedMentorJudge) console.log('   ' + line)
  if (report.failed.length > 0) {
    console.log(`! Failed                  : ${report.failed.length}`)
    for (const line of report.failed) console.log('   ' + line)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
