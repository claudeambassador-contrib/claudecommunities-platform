import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULT_SERVER_URL = 'https://claudecommunity.com.au'
export const STAGING_SERVER_URL = 'https://ccau.rockyshoreslabs.io'

// Stable loopback redirect — must match what we register via DCR so Clerk's
// /oauth/register dedupe (redirect_uris match) reuses the same OAuth app.
export const CALLBACK_PORT = 11789
export const CALLBACK_PATH = '/callback'
export const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`

export const CLIENT_NAME = 'Claude Community CLI'

// Precedence: explicit --server flag > CLAUDECOMMUNITY_CLI_URL env > CCAU_STAGING=1 > default (prod).
export function resolveServerUrl(opt?: string): string {
  const explicit = opt || process.env.CLAUDECOMMUNITY_CLI_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  if (isTruthyEnv(process.env.CCAU_STAGING)) return STAGING_SERVER_URL
  return DEFAULT_SERVER_URL
}

function isTruthyEnv(v: string | undefined): boolean {
  if (!v) return false
  return /^(1|true|yes|on)$/i.test(v.trim())
}

export function mcpEndpoint(serverUrl: string): string {
  return `${serverUrl}/mcp`
}

export function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'claudecommunity-cli')
}

// One profile per server URL so a single CLI can hold tokens for prod + staging
// + local dev simultaneously.
export function profileDir(serverUrl: string): string {
  const slug = serverUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
  return join(configDir(), 'profiles', slug)
}
