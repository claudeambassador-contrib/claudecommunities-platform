import { Command } from 'commander'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { connect, runInteractiveAuth } from '../client.js'
import { FileOAuthProvider } from '../oauth-provider.js'
import { resolveServerUrl } from '../config.js'
import { clearToolCache, writeToolCache } from '../tool-cache.js'
import { printResult } from './tools.js'

interface GlobalOpts {
  server?: string
  // commander stores --no-browser as `browser: false` (default true)
  browser?: boolean
}

function noBrowser(opts: GlobalOpts): boolean {
  return opts.browser === false
}

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Authenticate with the MCP server (OAuth via Clerk)')
    .action(async () => {
      const opts = program.opts<GlobalOpts>()
      const serverUrl = resolveServerUrl(opts.server)
      const provider = new FileOAuthProvider(serverUrl)
      const existing = await provider.tokens()
      if (existing?.access_token) {
        process.stderr.write('Already signed in. Run `ccau logout` first to switch accounts.\n')
        return
      }
      await runInteractiveAuth(provider, { serverUrl, noBrowser: noBrowser(opts) })
      process.stderr.write(`Signed in to ${serverUrl}.\n`)
      // Populate the tool cache so the noun/verb tree works without a network
      // hop on subsequent `ccau help` / `ccau <group>` calls.
      await refreshCache(serverUrl, noBrowser(opts))
    })

  program
    .command('logout')
    .description('Clear stored tokens for this server')
    .action(async () => {
      const opts = program.opts<GlobalOpts>()
      const serverUrl = resolveServerUrl(opts.server)
      const provider = new FileOAuthProvider(serverUrl)
      await provider.invalidateCredentials('tokens')
      await clearToolCache(serverUrl)
      process.stderr.write(`Cleared tokens and cached tool list for ${serverUrl}.\n`)
    })

  program
    .command('refresh')
    .description('Re-fetch the tool list from the server and update the local cache')
    .action(async () => {
      const opts = program.opts<GlobalOpts>()
      const serverUrl = resolveServerUrl(opts.server)
      await refreshCache(serverUrl, noBrowser(opts))
    })

  async function refreshCache(serverUrl: string, headless: boolean): Promise<void> {
    const connected = await connect({ serverUrl, noBrowser: headless })
    try {
      const list = await connected.client.listTools()
      await writeToolCache(serverUrl, list.tools)
      process.stderr.write(`Cached ${list.tools.length} tools.\n`)
    } finally {
      await connected.close()
    }
  }

  program
    .command('whoami')
    .description('Show the profile of the currently signed-in user')
    .action(async () => {
      const opts = program.opts<GlobalOpts>()
      const serverUrl = resolveServerUrl(opts.server)
      const connected = await connect({ serverUrl, noBrowser: noBrowser(opts) })
      try {
        const result = (await connected.client.callTool({ name: 'getUserProfile', arguments: {} })) as CallToolResult
        printResult(result, false)
        if (result.isError) process.exitCode = 1
      } finally {
        await connected.close()
      }
    })
}
