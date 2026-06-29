/** Set up a temporary test session on a participant that doesn't have one,
 * curl the portal page to capture any SSR error, then clear it. */
import { execSync } from "node:child_process";
import prisma from "../src/lib/prisma";

const TEST_TOKEN = 'probe-' + Math.random().toString(16).slice(2)

async function main() {
  // Find a participant who has NO session (so we don't kick anyone out).
  const p = await prisma.impactLabParticipant.findFirst({
    where: {
      role: 'participant',
      teamId: { not: null },
      sessionToken: null,
    },
    select: { id: true, name: true, team: { select: { name: true } } },
  })
  if (!p) {
    console.error('No participant without a session — using a placeholder.')
    return
  }
  console.log(`Using: ${p.name} (team=${p.team?.name})  token=${TEST_TOKEN}`)
  await prisma.impactLabParticipant.update({
    where: { id: p.id },
    data: { sessionToken: TEST_TOKEN },
  })
  try {
    const out = execSync(
      `curl -s -H "Cookie: impactlab_session=${TEST_TOKEN}" https://claudecommunity.com.au/impact-lab/portal -o /tmp/portal-real.html -w "status=%{http_code} size=%{size_download}\\n"`,
      { encoding: 'utf-8' },
    )
    console.log('\n' + out)
    const body = require('fs').readFileSync('/tmp/portal-real.html', 'utf-8')
    // Extract a meaningful slice: error title / next-data / first 800 chars
    const errMatch = body.match(/Application error|server-side exception|Digest:|<title>[^<]+<\/title>/g)
    console.log('matches in body:', errMatch ?? 'none')
    if (body.length < 2000) {
      console.log('\nFull body:\n' + body)
    } else {
      console.log('\nFirst 1000 chars:\n' + body.slice(0, 1000))
    }
  } finally {
    await prisma.impactLabParticipant.update({
      where: { id: p.id },
      data: { sessionToken: null },
    })
    console.log('\nCleared test session token.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
