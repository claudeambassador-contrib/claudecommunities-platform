import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import prisma from "../src/lib/prisma";

async function main() {
  const me = await prisma.impactLabParticipant.findUnique({
    where: { email: 'spruik.au@gmail.com' },
  })
  if (!me?.sessionToken) {
    console.log('No session')
    return
  }
  const html = execSync(
    `curl -s -H "Cookie: impactlab_session=${me.sessionToken}" https://claudecommunity.com.au/impact-lab/portal`,
    { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
  )
  writeFileSync('portal-rye.html', html)
  console.log('Body length:', html.length)
  const checks = [
    'Solution name',
    'github.com',
    'repo link',
    'conceptRepoUrl',
    'https://github',
    'Your idea',
    'Idea title',
    'team.conceptTitle',
  ]
  for (const c of checks) {
    const found = html.includes(c)
    console.log(`  ${found ? '✓' : '✗'} ${c}`)
  }
  // Check JSON state in __NEXT_DATA__
  const dataMatch = html.match(/conceptTitle[^,]*,[^,]*conceptSummary[^,]*,[^,]*conceptRepoUrl[^,]*/)
  if (dataMatch) console.log('\nProps match:', dataMatch[0].slice(0, 200))
}

main().catch(console.error).finally(() => prisma.$disconnect())
