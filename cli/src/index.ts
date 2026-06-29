#!/usr/bin/env node
import { Command } from 'commander'
import { registerAuthCommands } from './commands/auth.js'
import { registerToolTree } from './commands/dispatch.js'
import { registerCallCommand, registerListCommand } from './commands/tools.js'
import { DEFAULT_SERVER_URL, resolveServerUrl } from './config.js'
import { readToolCacheSync } from './tool-cache.js'

async function main() {
  const program = new Command()
    .name('ccau')
    .description('CLI for the Claude Community AU MCP server.\n\nRun `ccau login` first — it caches the server tool list so all other commands work offline-style (no extra network hop just to render help).')
    .version('0.1.0')
    .option(
      '-s, --server <url>',
      `MCP server origin (default: env CLAUDECOMMUNITY_CLI_URL or ${DEFAULT_SERVER_URL})`,
    )
    // Commander turns --no-browser into `opts.browser = false` (defaulting true).
    .option('--no-browser', "Don't auto-open a browser; print the URL and read the pasted redirect")
    .option('--json', 'Output raw JSON instead of pretty text')
    .showHelpAfterError()

  registerAuthCommands(program)
  registerListCommand(program)
  registerCallCommand(program)

  // Build the noun/verb tree from the cached tool list. No network involved —
  // if the cache is missing the user just sees an unfilled help screen and a
  // nudge to run `ccau login`.
  //
  // The cache is keyed by server URL, but at this point commander hasn't
  // parsed argv yet, so we have to resolve --server / env vars ourselves.
  const serverUrl = resolveServerUrl(peekServerOverride(process.argv))
  const cached = readToolCacheSync(serverUrl)
  if (cached) {
    registerToolTree(program, cached)
  } else {
    program.addHelpText(
      'after',
      `\nNo cached tool list for ${serverUrl}. Run \`ccau login\` to populate it.`,
    )
  }

  await program.parseAsync(process.argv)
}

/**
 * Pre-parse argv just enough to find `--server <url>` / `-s <url>` before
 * commander runs. Defers to commander for actual validation.
 */
function peekServerOverride(argv: readonly string[]): string | undefined {
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-s' || a === '--server') return argv[i + 1]
    if (a.startsWith('--server=')) return a.slice('--server='.length)
  }
  return undefined
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`Error: ${msg}\n`)
  process.exit(1)
})
