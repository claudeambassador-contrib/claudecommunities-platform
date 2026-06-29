import { execSync } from "node:child_process";
import prisma from "../src/lib/prisma";

async function main() {
  const me = await prisma.impactLabParticipant.findUnique({
    where: { email: 'spruik.au@gmail.com' },
    include: { team: true, vote: true, peoplesChoiceVote: true },
  })
  if (!me) {
    console.error('Not found')
    return
  }
  console.log('Participant:')
  console.log(`  id=${me.id}`)
  console.log(`  name=${me.name}`)
  console.log(`  email=${me.email}`)
  console.log(`  teamId=${me.teamId}`)
  console.log(`  checkedIn=${me.checkedIn}`)
  console.log(`  sessionToken=${me.sessionToken?.slice(0, 12)}...`)
  console.log(`  team=`, me.team ? `${me.team.name} (tableNumber=${me.team.tableNumber})` : null)

  if (me.sessionToken) {
    // Hit the portal with this session
    const out = execSync(
      `curl -s -H "Cookie: impactlab_session=${me.sessionToken}" https://claudecommunity.com.au/impact-lab/portal -o /tmp/portal-rye.html -w "status=%{http_code} size=%{size_download}\\n"`,
      { encoding: 'utf-8' },
    )
    console.log('\nPortal response:', out.trim())
    const body = require('fs').readFileSync('/tmp/portal-rye.html', 'utf-8')
    const hits = body.match(
      /Your team|not been placed on a team yet|Team 999|"999"|team-not-set|conceptTitle|No team/g,
    )
    console.log('Mentions in body:', hits)
    // Look for the rendered team name
    const teamMatch = body.match(/<span[^>]*>([^<]*?)<\/span>[^<]*<span[^>]*>·\s*Table/)
    if (teamMatch) console.log('Rendered team name:', JSON.stringify(teamMatch[1]))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
