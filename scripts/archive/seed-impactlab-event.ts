/**
 * One-off seed for the live Impact Lab event (23 May 2026).
 *
 * Idempotent — safe to re-run. It will:
 *   1. Replace all schedule items with the participant-friendly run sheet.
 *   2. Upsert resources (Build / Data / Awards / Community).
 *   3. Ensure teams "Team 1" .. "Team 11" exist with matching tableNumber.
 *   4. Upsert all confirmed participants with placeholder emails so they
 *      show up grouped by team in the admin dashboard. Real check-in by
 *      real email will create a fresh participant row — admins can clean up
 *      placeholders afterwards.
 *
 * NOTE: This script imports the D1-bound Prisma proxy from src/lib/prisma,
 * which only resolves inside a Cloudflare Worker request context. Run it
 * against the dev server (bun run dev:cf) via a one-off admin endpoint, or
 * port it to a wrangler-based SQL seed before invoking standalone.
 */
import prisma from "../src/lib/prisma";
import {
  COFFEE_POOL_SIZE,
  defaultProblemStatements,
  defaultResources,
  defaultSchedule,
  randomTeamColor,
  uniqueCoffeeCode,
} from "../src/lib/services/impactLab";
import { getRegionConfig } from "../src/lib/region";

const TEAM_COUNT = 11

type ParticipantSeed = {
  name: string
  role?: 'participant' | 'mentor' | 'judge'
  team: number
  /** Display-only — not stored. */
  company?: string
  /** Marks people listed as "Pending" in the roster. */
  pending?: boolean
}

const participants: ParticipantSeed[] = [
  // Team 1
  { name: 'Murray Galbraith', team: 1, company: 'Heumans.com' },
  { name: 'Abhilash Venkatesh', team: 1, company: 'Fabric Group' },
  { name: 'Ishaan Kataria', team: 1, company: 'Monash University' },
  { name: 'Shaugato Paroi', team: 1, company: 'PageUp' },
  { name: 'Marco Meyer', team: 1, company: 'JET Charge' },
  { name: 'Darren', team: 1, company: 'Defence' },

  // Team 2
  { name: 'Tracy Anthony', team: 2, company: 'Real Minds Artificial Intelligence' },
  { name: 'Luke Stephenson', team: 2, company: 'Zendesk' },
  { name: 'Wing Lok Oliver Chan', team: 2, company: 'IAG & Monash University' },
  { name: 'Thiago Sinji Shimada Ramos', team: 2, company: 'DNX Solutions' },
  { name: 'Ashar Jamil', team: 2, company: 'Aizzr Pty Ltd' },
  { name: 'Fiona Lai', team: 2, company: 'Worked at Telstra Health' },

  // Team 3
  { name: 'Praney Behl', team: 3, company: 'Seed Blocks Pty Ltd' },
  { name: 'Ali Shakeri', team: 3, company: 'Clarity' },
  { name: 'Paakhi Dodwani', team: 3, company: 'University of Sydney' },
  { name: 'Vitaliy Baschlykoff', team: 3, company: 'MongoDB' },
  { name: 'Esther Nitafan', team: 3, company: 'UpGuard' },
  { name: 'Kyle Berkow', team: 3, company: 'Foxo Healthcare' },

  // Team 4
  { name: 'Ruwangi Fernando', team: 4, company: 'Victoria University' },
  { name: 'Tim Lacey', team: 4, company: 'Foxtel' },
  { name: 'Advita Velury', team: 4, company: 'Monash University' },
  { name: 'Ritesh Hiremath', team: 4, company: 'Sweethawk' },
  { name: 'Saumya', team: 4, company: 'Westpac' },
  { name: 'Luke McManus', team: 4, company: 'Team Topologies', pending: true },

  // Team 5
  { name: 'Matthew Piga', team: 5, company: 'Envato' },
  { name: 'Elysha', team: 5, company: 'Harmony Intelligence' },
  { name: 'Ravi Kumawat', team: 5, company: 'Student' },
  { name: 'Melanie Thewlis', team: 5, company: 'Sitemate' },
  { name: 'Hannah Moore', team: 5, company: 'JET Charge' },
  { name: 'Sumayya', team: 5, company: 'Capgemini' },

  // Team 6
  { name: 'Giorgio Liapakis', team: 6, company: 'Wibci' },
  { name: 'Sandy Buchanan', team: 6, company: 'JupiterAI & Solo work' },
  { name: 'Jaime Orelowitz', team: 6, company: 'University of Melbourne' },
  { name: 'Jahnavi D', team: 6, company: "Murdoch Children's Research Institute" },
  { name: 'Tamara Fernandez', team: 6, company: 'MYOB' },
  { name: 'David Chung', team: 6, company: 'Civica', pending: true },

  // Team 7
  { name: 'Khoa Pham', team: 7, company: 'Monash University' },
  { name: 'Aashish Jolly', team: 7, company: 'Versent Pty Ltd' },
  { name: 'Sarah Brown', team: 7, company: 'Currently seeking work' },
  { name: 'Natalie Byrgiotis', team: 7, company: 'Ippon Australia' },
  { name: 'Gunjan', team: 7, company: 'Freelancer (recent graduate)' },
  { name: 'Stephen Grocott', team: 7, company: 'Contracting + ag startup' },

  // Team 8
  { name: 'Ken Fretwell', team: 8, company: 'Defence' },
  { name: 'Blake Ryan', team: 8, company: 'Swinburne Uni + HoTF/Atrium Studio' },
  { name: 'Ryan Haque', team: 8, company: 'CBA' },
  { name: 'Eden', team: 8, company: 'Uptick' },
  { name: 'Gerard Roche', team: 8, company: 'PuntyAI (side project)' },
  { name: 'Sergey Iakovlev', team: 8, company: 'Canva' },
  { name: 'Sean Callanan', team: 8, company: 'Sports Geek', pending: true },

  // Team 9
  { name: 'Azadeh Alavi', team: 9, company: 'RMIT & Pattern Recognition Pty Ltd' },
  { name: 'Prosper Musukuma', team: 9, company: 'Rental Buddy AU' },
  { name: 'Jasper Ellis', team: 9, company: 'Helfie AI / Monash University' },
  { name: 'Michelle Mannering', team: 9, company: 'Twilio' },
  { name: 'Teddy Flauzer', team: 9, company: 'Swinburne / Tartu / ChopDot.xyz' },
  { name: 'Sharon L', team: 9, company: 'Consulting - M&A' },
  { name: 'Richard Fu', team: 9, company: 'Easygo' },

  // Team 10
  { name: 'Stuart Sim', team: 10, company: 'Slate' },
  { name: 'Steven Merriel', team: 10, company: 'Cairn AI' },
  { name: 'Alex', team: 10, company: 'Melbourne' },
  { name: 'Jack Thomas', team: 10, company: 'Melbourne Cricket Ground' },

  // Team 11
  { name: 'Ryan Sinnott', team: 11, company: 'Startup' },
  { name: 'Ryan', team: 11, company: 'BMW Financial Services' },
  { name: 'Matthew Blode', team: 11, company: 'Linktree' },
  { name: 'Jodi English', team: 11, company: 'MYOB' },
]

// Mentors and judges. Real emails, no team assignment.
// Dual mentor/judge people are marked 'judge' (the more visible role).
type MentorSeed = {
  name: string
  email: string
  role: 'mentor' | 'judge'
  organisation?: string
}

const mentorsAndJudges: MentorSeed[] = [
  { name: 'Matthew McKinlay', email: 'matt@tana.inc', role: 'judge', organisation: 'TANA' },
  { name: 'Gaz Williams', email: 'gw@grpgrp.co', role: 'mentor', organisation: 'GRP' },
  { name: 'Liz Blink', email: 'lizjblink@gmail.com', role: 'judge' },
  { name: 'Dave King', email: 'dave@radicalintelligence.ai', role: 'judge' },
  { name: 'Ben Flint', email: 'ben@supernormalsystems.com.au', role: 'judge' },
  { name: 'Jeanette Cheah', email: 'jeanette@startwithhex.com', role: 'judge', organisation: 'Hex' },
  { name: 'Stephen Colman', email: 'stephen.colman@stratumlabs.com.au', role: 'judge', organisation: 'Stratum Labs' },
  { name: 'Dominik Fretz', email: 'dominik.fretz@harbouredgeintelligence.com', role: 'judge', organisation: 'Claude Code Ambassador' },
  { name: 'Matthew Morgan', email: 'matt@matthewmorgan.com.au', role: 'judge', organisation: 'Regional Council' },
  { name: 'Fab Mackojc', email: 'fab.mackojc@gmail.com', role: 'mentor' },
  { name: 'Ross Green', email: 'ross.green@vichealth.vic.gov.au', role: 'mentor' },
  { name: 'Humphrey Laubscher', email: 'humphrey@applylean.com.au', role: 'mentor' },
  { name: 'Emeli Paulo', email: 'emeli@collectivepotential.com.au', role: 'mentor' },
  { name: 'Marshy', email: 'hello@lukemarshall.net', role: 'mentor' },
  { name: 'Lucy Lin', email: 'lucy@forestlyn.com', role: 'judge' },
  { name: 'Rohit Bhargava', email: 'rohit@startupplaybook.co', role: 'mentor' },
  { name: 'Richard Lipp', email: 'richard@divergentkind.com.au', role: 'judge', organisation: 'Divergent Kind' },
  { name: 'Tracy Anthony', email: 'tracy.anthony@realmindsai.au', role: 'mentor', organisation: 'Real Minds AI' },
  { name: 'Stephen Johnston', email: 'stephen@fordcastle.com', role: 'mentor' },
]

function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function placeholderEmail(name: string, team: number): string {
  const slug = slugify(name) || 'participant'
  return `${slug}-t${team}@impactlab.local`
}

async function replaceSchedule() {
  console.log('• Replacing schedule items…')
  await prisma.impactLabScheduleItem.deleteMany({})
  await prisma.impactLabScheduleItem.createMany({ data: defaultSchedule() })
  console.log(`  ${defaultSchedule().length} items inserted.`)
}

async function replaceProblemStatements() {
  console.log('• Replacing problem statements…')
  const voteCount = await prisma.impactLabVote.count()
  if (voteCount > 0) {
    console.warn(
      `  ⚠️  ${voteCount} votes already exist — refusing to replace. Reset votes via admin first if you really need to.`,
    )
    return
  }
  // Cascade-deletes any votes (none, per the check above) and clears
  // winningStatementId so it doesn't point at a deleted row.
  await prisma.impactLabConfig.updateMany({
    where: { id: 'config' },
    data: { winningStatementId: null },
  })
  await prisma.impactLabProblemStatement.deleteMany({})
  await prisma.impactLabProblemStatement.createMany({ data: defaultProblemStatements() })
  console.log(`  ${defaultProblemStatements().length} statements inserted.`)
}

async function upsertResources() {
  console.log('• Upserting resources (matched by title)…')
  let created = 0
  let updated = 0
  const region = getRegionConfig();
  for (const r of defaultResources({
    discordCommunityInvite: region.discordCommunityInvite,
    communityName: region.communityName,
    siteUrl: region.siteUrl,
  })) {
    const existing = await prisma.impactLabResource.findFirst({
      where: { title: r.title },
      select: { id: true },
    })
    if (existing) {
      await prisma.impactLabResource.update({ where: { id: existing.id }, data: r })
      updated++
    } else {
      await prisma.impactLabResource.create({ data: r })
      created++
    }
  }
  console.log(`  created ${created}, updated ${updated}.`)
}

async function ensureTeams(): Promise<Map<number, string>> {
  console.log(`• Ensuring Team 1..${TEAM_COUNT} exist…`)
  const byNumber = new Map<number, string>()
  for (let n = 1; n <= TEAM_COUNT; n++) {
    const name = `Team ${n}`
    const existing = await prisma.impactLabTeam.findUnique({ where: { name } })
    if (existing) {
      // Backfill tableNumber if missing — don't clobber if admin set one.
      if (!existing.tableNumber) {
        await prisma.impactLabTeam.update({
          where: { id: existing.id },
          data: { tableNumber: String(n) },
        })
      }
      byNumber.set(n, existing.id)
    } else {
      const team = await prisma.impactLabTeam.create({
        data: { name, color: randomTeamColor(), tableNumber: String(n) },
      })
      byNumber.set(n, team.id)
    }
  }
  return byNumber
}

async function seedCoffeePool(target: number) {
  console.log(`• Seeding coffee pool to ${target} codes…`)
  const existing = await prisma.impactLabCoffeeCode.count()
  if (existing >= target) {
    console.log(`  pool already has ${existing} codes — nothing to do.`)
    return
  }
  // Find the highest existing order so we don't collide.
  const last = await prisma.impactLabCoffeeCode.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const startOrder = (last?.order ?? 0) + 1
  for (let i = 0; i < target - existing; i++) {
    await prisma.impactLabCoffeeCode.create({
      data: { code: await uniqueCoffeeCode(), order: startOrder + i },
    })
  }
  console.log(`  added ${target - existing} codes.`)
}

/** Claim the next unassigned pool code, returning the code string + pool row id. */
async function nextPoolCode(): Promise<{ code: string; poolId: string } | null> {
  const entry = await prisma.impactLabCoffeeCode.findFirst({
    where: { participantId: null },
    orderBy: { order: 'asc' },
    select: { id: true, code: true },
  })
  return entry ? { code: entry.code, poolId: entry.id } : null
}

async function upsertParticipants(teamIds: Map<number, string>) {
  console.log(`• Upserting ${participants.length} participants…`)
  let created = 0
  let updated = 0
  let skipped = 0
  for (const p of participants) {
    const email = placeholderEmail(p.name, p.team)
    const teamId = teamIds.get(p.team)
    if (!teamId) {
      console.warn(`  ! No team for ${p.name} (team ${p.team}) — skipping`)
      skipped++
      continue
    }
    const existing = await prisma.impactLabParticipant.findUnique({
      where: { email },
      include: { coffeeCodeEntry: { select: { id: true } } },
    })
    if (existing) {
      // If they don't yet have a pool entry, claim one for them.
      if (!existing.coffeeCodeEntry) {
        const next = await nextPoolCode()
        if (next) {
          await prisma.$transaction([
            prisma.impactLabParticipant.update({
              where: { id: existing.id },
              data: {
                name: p.name,
                role: p.role ?? 'participant',
                teamId,
                preRegistered: true,
                coffeeCode: next.code,
              },
            }),
            prisma.impactLabCoffeeCode.update({
              where: { id: next.poolId },
              data: { participantId: existing.id },
            }),
          ])
        } else {
          await prisma.impactLabParticipant.update({
            where: { id: existing.id },
            data: { name: p.name, role: p.role ?? 'participant', teamId, preRegistered: true },
          })
        }
      } else {
        await prisma.impactLabParticipant.update({
          where: { id: existing.id },
          data: { name: p.name, role: p.role ?? 'participant', teamId, preRegistered: true },
        })
      }
      updated++
    } else {
      const next = await nextPoolCode()
      const code = next?.code ?? (await uniqueCoffeeCode())
      const participant = await prisma.impactLabParticipant.create({
        data: {
          name: p.name,
          email,
          role: p.role ?? 'participant',
          teamId,
          coffeeCode: code,
          preRegistered: true,
        },
      })
      if (next) {
        await prisma.impactLabCoffeeCode.update({
          where: { id: next.poolId },
          data: { participantId: participant.id },
        })
      }
      created++
    }
  }
  console.log(`  created ${created}, updated ${updated}, skipped ${skipped}.`)
}

async function upsertMentorsAndJudges() {
  console.log(`• Upserting ${mentorsAndJudges.length} mentors/judges…`)
  let created = 0
  let updated = 0
  for (const m of mentorsAndJudges) {
    const email = m.email.toLowerCase()
    const existing = await prisma.impactLabParticipant.findUnique({
      where: { email },
      include: { coffeeCodeEntry: { select: { id: true } } },
    })
    if (existing) {
      await prisma.impactLabParticipant.update({
        where: { id: existing.id },
        data: { name: m.name, role: m.role, preRegistered: true },
      })
      // Claim a pool code if they don't have one yet
      if (!existing.coffeeCodeEntry) {
        const next = await nextPoolCode()
        if (next) {
          await prisma.$transaction([
            prisma.impactLabParticipant.update({
              where: { id: existing.id },
              data: { coffeeCode: next.code },
            }),
            prisma.impactLabCoffeeCode.update({
              where: { id: next.poolId },
              data: { participantId: existing.id },
            }),
          ])
        }
      }
      updated++
    } else {
      const next = await nextPoolCode()
      const code = next?.code ?? (await uniqueCoffeeCode())
      const created2 = await prisma.impactLabParticipant.create({
        data: {
          name: m.name,
          email,
          role: m.role,
          coffeeCode: code,
          preRegistered: true,
        },
      })
      if (next) {
        await prisma.impactLabCoffeeCode.update({
          where: { id: next.poolId },
          data: { participantId: created2.id },
        })
      }
      created++
    }
  }
  console.log(`  created ${created}, updated ${updated}.`)
}

async function main() {
  console.log('Seeding Impact Lab event data…\n')
  await replaceSchedule()
  await replaceProblemStatements()
  await upsertResources()
  const teamIds = await ensureTeams()
  await seedCoffeePool(COFFEE_POOL_SIZE)
  await upsertParticipants(teamIds)
  await upsertMentorsAndJudges()
  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
