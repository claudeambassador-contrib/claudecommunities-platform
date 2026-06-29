import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  OAuthClientProvider,
} from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { CLIENT_NAME, REDIRECT_URI, profileDir } from './config.js'

interface PendingRedirect {
  open: (url: URL) => void | Promise<void>
}

/**
 * File-backed OAuthClientProvider. The MCP SDK drives the OAuth dance; we
 * just persist tokens, client info, and the PKCE verifier between steps.
 */
export class FileOAuthProvider implements OAuthClientProvider {
  private readonly dir: string
  private readonly tokensPath: string
  private readonly clientInfoPath: string
  private readonly verifierPath: string
  private pendingRedirect: PendingRedirect | null = null

  constructor(serverUrl: string) {
    this.dir = profileDir(serverUrl)
    this.tokensPath = join(this.dir, 'tokens.json')
    this.clientInfoPath = join(this.dir, 'client.json')
    this.verifierPath = join(this.dir, 'verifier.txt')
  }

  /** Register a callback the SDK will invoke when it needs to send the user to the authorize URL. */
  setRedirectHandler(handler: PendingRedirect | null) {
    this.pendingRedirect = handler
  }

  get redirectUrl(): string {
    return REDIRECT_URI
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: CLIENT_NAME,
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // Public client — no secret stored on disk in plain text.
      token_endpoint_auth_method: 'none',
      scope: 'profile email',
    }
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    return readJson<OAuthClientInformationFull>(this.clientInfoPath)
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    await writeJson(this.clientInfoPath, info)
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return readJson<OAuthTokens>(this.tokensPath)
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await writeJson(this.tokensPath, tokens)
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (!this.pendingRedirect) {
      // Fall back to printing the URL — better than swallowing the request.
      process.stderr.write(`\nOpen this URL in your browser to authorize:\n${authorizationUrl.toString()}\n\n`)
      return
    }
    await this.pendingRedirect.open(authorizationUrl)
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    await ensureDir(this.dir)
    await fs.writeFile(this.verifierPath, verifier, { mode: 0o600 })
  }

  async codeVerifier(): Promise<string> {
    return fs.readFile(this.verifierPath, 'utf8')
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
    const targets: string[] = []
    if (scope === 'all' || scope === 'tokens') targets.push(this.tokensPath)
    if (scope === 'all' || scope === 'client') targets.push(this.clientInfoPath)
    if (scope === 'all' || scope === 'verifier') targets.push(this.verifierPath)
    await Promise.all(
      targets.map(async (p) => {
        try {
          await fs.unlink(p)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }
      }),
    )
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(path, 'utf8')
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf('/'))
  await ensureDir(dir)
  await fs.writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 })
}
