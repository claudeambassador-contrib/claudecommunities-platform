import { Command } from 'commander'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { connect } from '../client.js'
import { resolveServerUrl } from '../config.js'

interface GlobalOpts {
  server?: string
  // commander stores --no-browser as `browser: false` (default true)
  browser?: boolean
  json?: boolean
}

function noBrowser(opts: GlobalOpts): boolean {
  return opts.browser === false
}

/**
 * `ccau list` — scripting-friendly enumeration of the live tool list.
 * Hits the network, so reflects whatever the server currently exposes.
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all tools exposed by the MCP server (live, not cached)')
    .action(async () => {
      const globalOpts = program.opts<GlobalOpts>()
      const serverUrl = resolveServerUrl(globalOpts.server)
      const connected = await connect({ serverUrl, noBrowser: noBrowser(globalOpts) })
      try {
        const list = await connected.client.listTools()
        if (globalOpts.json) {
          process.stdout.write(JSON.stringify(list.tools, null, 2) + '\n')
        } else {
          for (const t of list.tools) {
            process.stdout.write(`${t.name.padEnd(28)} ${t.description ?? ''}\n`)
          }
        }
      } finally {
        await connected.close()
      }
    })
}

export function printResult(result: CallToolResult, jsonMode: boolean): void {
  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }
  const items = Array.isArray(result.content) ? result.content : []
  for (const item of items) {
    if (item.type === 'text' && typeof item.text === 'string') {
      process.stdout.write(item.text + '\n')
    } else {
      process.stdout.write(JSON.stringify(item, null, 2) + '\n')
    }
  }
}

/**
 * `ccau call <tool> --args '<json>'` — invoke a tool by its raw MCP name
 * with a JSON blob of arguments. Useful for tools that aren't in the
 * command map yet.
 */
export function registerCallCommand(program: Command): void {
  program
    .command('call <tool>')
    .description('Invoke a tool by name, passing arguments as JSON via --args')
    .option('--args <json>', 'JSON string of arguments', '{}')
    .action(async (tool: string, opts: { args: string }) => {
      const globalOpts = program.opts<GlobalOpts>()
      const serverUrl = resolveServerUrl(globalOpts.server)
      let args: Record<string, unknown>
      try {
        args = JSON.parse(opts.args)
      } catch (err) {
        throw new Error(`--args must be valid JSON: ${(err as Error).message}`)
      }
      const connected = await connect({ serverUrl, noBrowser: noBrowser(globalOpts) })
      try {
        const result = (await connected.client.callTool({ name: tool, arguments: args })) as CallToolResult
        printResult(result, !!globalOpts.json)
        if (result.isError) process.exitCode = 1
      } finally {
        await connected.close()
      }
    })
}
