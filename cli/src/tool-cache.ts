import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { profileDir } from './config.js'

interface CachedTools {
  serverUrl: string
  fetchedAt: string
  tools: Tool[]
}

function cachePath(serverUrl: string): string {
  return join(profileDir(serverUrl), 'tools.json')
}

/**
 * Synchronous read of the cached tool list — used at startup, before commander
 * parses argv, so we can register subcommands without awaiting a fetch.
 * Returns undefined if no cache exists yet.
 */
export function readToolCacheSync(serverUrl: string): Tool[] | undefined {
  try {
    const raw = readFileSync(cachePath(serverUrl), 'utf8')
    const parsed = JSON.parse(raw) as CachedTools
    return parsed.tools
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    // Corrupt cache shouldn't kill the CLI — just behave as if missing.
    return undefined
  }
}

export async function writeToolCache(serverUrl: string, tools: Tool[]): Promise<void> {
  const data: CachedTools = {
    serverUrl,
    fetchedAt: new Date().toISOString(),
    tools,
  }
  const path = cachePath(serverUrl)
  const dir = path.substring(0, path.lastIndexOf('/'))
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  await fs.writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export async function clearToolCache(serverUrl: string): Promise<void> {
  try {
    await fs.unlink(cachePath(serverUrl))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}
