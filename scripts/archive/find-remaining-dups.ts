/** Surface remaining placeholder/real duplicates where the names didn't
 * fuzzy-match (e.g. Saumya/Saumya Mutneja, Fithri/Fithriyah Shalihah,
 * Oliver Chan/Wing Lok Oliver Chan). */
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
function firstToken(s: string): string {
  return norm(s).split(' ')[0] ?? ''
}

async function main() {
  const all = await prisma.impactLabParticipant.findMany({
    where: { role: 'participant' },
    select: {
      id: true,
      name: true,
      email: true,
      teamId: true,
      team: { select: { name: true } },
    },
  })
  const real = all.filter((p) => !p.email.endsWith(PLACEHOLDER_DOMAIN))
  const placeholders = all.filter((p) => p.email.endsWith(PLACEHOLDER_DOMAIN))

  console.log('Placeholders that share a first-name token with a real check-in:')
  for (const ph of placeholders) {
    const phFirst = firstToken(ph.name)
    const matches = real.filter((r) => firstToken(r.name) === phFirst)
    if (matches.length === 0) continue
    console.log(
      `  · ${ph.name.padEnd(28)} (${ph.team?.name ?? 'no team'}) ← real candidate(s):`,
    )
    for (const m of matches) {
      console.log(
        `      → ${m.name.padEnd(26)} (${m.team?.name ?? 'no team'})  <${m.email}>`,
      )
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
