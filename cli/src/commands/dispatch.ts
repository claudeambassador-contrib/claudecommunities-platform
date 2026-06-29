import { Command } from 'commander'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { connect } from '../client.js'
import { resolveServerUrl } from '../config.js'
import { lookupMapping } from '../command-map.js'
import { applyToolSchema } from '../schema-to-flags.js'
import { printResult } from './tools.js'

interface GlobalOpts {
  server?: string
  browser?: boolean
  json?: boolean
}

function noBrowser(opts: GlobalOpts): boolean {
  return opts.browser === false
}

/**
 * Build the noun/verb command tree from a cached tool list.
 *
 * Each tool either:
 *  - has a CommandMapping → lives at `program <group> <command>` with friendly
 *    flags and positional args derived from the mapping, or
 *  - has none → registered under `program raw <toolName>` as a flat fallback
 *    so new server tools work without a CLI release.
 *
 * This whole tree is registered synchronously, before commander parses argv.
 */
export function registerToolTree(program: Command, tools: Tool[]): void {
  const groups = new Map<string, Command>()
  // Lazily create a `raw` group only if at least one tool falls through.
  let rawGroup: Command | undefined

  for (const tool of tools) {
    const mapping = lookupMapping(tool.name)
    if (mapping) {
      const group = ensureGroup(program, groups, mapping.group)
      registerLeaf(group, tool, mapping.command, mapping.description ?? tool.description ?? '', mapping)
    } else {
      rawGroup ??= program
        .command('raw')
        .description('Invoke tools by their raw MCP name (fallback for unmapped tools)')
      registerLeaf(rawGroup, tool, tool.name, tool.description ?? '', undefined)
    }
  }
}

function ensureGroup(program: Command, groups: Map<string, Command>, name: string): Command {
  const existing = groups.get(name)
  if (existing) return existing
  const created = program.command(name).description(groupDescription(name))
  groups.set(name, created)
  return created
}

function groupDescription(name: string): string {
  // Auto-generated default — keeps the top-level help readable without a
  // hand-written description per group.
  const friendly = name.replace(/-/g, ' ')
  return `${friendly} commands`
}

function registerLeaf(
  parent: Command,
  tool: Tool,
  verb: string,
  description: string,
  mapping: ReturnType<typeof lookupMapping>,
): void {
  const leaf = parent
    .command(verb)
    .description(description)
    .helpOption('-h, --help', 'Show help for this command')

  const schemaApp = applyToolSchema(leaf, tool.inputSchema as never, mapping)

  leaf.action(async (...commanderArgs: unknown[]) => {
    const program = topLevel(leaf)
    const globalOpts = program.opts<GlobalOpts>()
    const serverUrl = resolveServerUrl(globalOpts.server)
    const args = schemaApp.buildArgs(commanderArgs)

    const connected = await connect({ serverUrl, noBrowser: noBrowser(globalOpts) })
    try {
      const result = (await connected.client.callTool({ name: tool.name, arguments: args })) as CallToolResult
      printResult(result, !!globalOpts.json)
      if (result.isError) process.exitCode = 1
    } finally {
      await connected.close()
    }
  })
}

function topLevel(cmd: Command): Command {
  let curr = cmd
  while (curr.parent) curr = curr.parent
  return curr
}
