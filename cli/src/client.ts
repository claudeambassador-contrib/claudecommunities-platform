import { createInterface } from 'node:readline/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import open from 'open'
import { awaitOAuthCallback } from './callback-server.js'
import { FileOAuthProvider } from './oauth-provider.js'
import { mcpEndpoint } from './config.js'

export interface ConnectOptions {
  serverUrl: string
  /** If true, never open a browser — print the URL and read the redirected URL from stdin. */
  noBrowser?: boolean
  /** If true, surface "not signed in" as an error instead of starting the OAuth flow. */
  noInteractiveAuth?: boolean
}

export interface ConnectedClient {
  client: Client
  close: () => Promise<void>
}

/**
 * Connect a Client to the server's MCP endpoint, performing the OAuth dance
 * on demand (when the server responds with 401 / Unauthorized).
 */
export async function connect(opts: ConnectOptions): Promise<ConnectedClient> {
  const provider = new FileOAuthProvider(opts.serverUrl)
  const endpoint = new URL(mcpEndpoint(opts.serverUrl))

  const makeTransport = () =>
    new StreamableHTTPClientTransport(endpoint, { authProvider: provider })

  const tryConnect = async (): Promise<ConnectedClient> => {
    const transport = makeTransport()
    const client = new Client({ name: 'claudecommunity-cli', version: '0.1.0' })
    try {
      await client.connect(transport)
    } catch (err) {
      await safeClose(transport)
      throw err
    }
    return {
      client,
      close: async () => {
        await safeClose(client)
      },
    }
  }

  try {
    return await tryConnect()
  } catch (err) {
    if (!isAuthError(err)) throw err
    if (opts.noInteractiveAuth) {
      throw new Error('Not signed in. Run `ccau login` first.')
    }
    await runInteractiveAuth(provider, opts)
    // After auth completes, retry the connection — the provider now has tokens.
    return await tryConnect()
  }
}

/**
 * Drive the full OAuth flow start-to-finish using the provider's plumbing.
 * The MCP SDK's auth() helper handles discovery, DCR, PKCE, and token exchange;
 * we just listen for the redirect and feed the code back in via finishAuth().
 */
export async function runInteractiveAuth(
  provider: FileOAuthProvider,
  opts: ConnectOptions,
): Promise<void> {
  // Wire the provider's redirect handler: open the browser (or print the URL)
  // and wait for the callback server to receive the code.
  const callback = opts.noBrowser ? null : awaitOAuthCallback()

  let resolveCode: (code: string) => void
  let rejectCode: (err: Error) => void
  const codePromise = new Promise<string>((res, rej) => {
    resolveCode = res
    rejectCode = rej
  })

  if (callback) {
    callback.promise.then((r) => resolveCode(r.code)).catch((e) => rejectCode(e))
  }

  provider.setRedirectHandler({
    open: async (url) => {
      if (opts.noBrowser) {
        process.stderr.write(
          `\nOpen this URL in a browser:\n${url.toString()}\n\nAfter approving, paste the FULL redirect URL (the http://127.0.0.1:... URL that fails to load) here:\n> `,
        )
        const rl = createInterface({ input: process.stdin, output: process.stderr })
        try {
          const pasted = (await rl.question('')).trim()
          const code = new URL(pasted).searchParams.get('code')
          if (!code) {
            rejectCode(new Error('Pasted URL has no `code` parameter.'))
            return
          }
          resolveCode(code)
        } finally {
          rl.close()
        }
      } else {
        process.stderr.write(`Opening browser to authorize…\nIf nothing opens, visit:\n${url.toString()}\n`)
        try {
          await open(url.toString())
        } catch {
          process.stderr.write('Failed to launch a browser automatically. Open the URL above manually.\n')
        }
      }
    },
  })

  // Trigger the OAuth flow. First connect attempt will fail with
  // UnauthorizedError after redirectToAuthorization is invoked.
  const transport = new StreamableHTTPClientTransport(new URL(mcpEndpoint(opts.serverUrl)), {
    authProvider: provider,
  })
  const client = new Client({ name: 'claudecommunity-cli', version: '0.1.0' })

  // The first connect() call is expected to throw — that's how the SDK signals
  // "I just told the user to authorize; come back with the code".
  const initialConnectPromise = client.connect(transport).catch((err) => {
    if (!isAuthError(err)) throw err
  })

  try {
    const code = await codePromise
    await initialConnectPromise
    await transport.finishAuth(code)
  } finally {
    callback?.close()
    provider.setRedirectHandler(null)
    await safeClose(client)
    await safeClose(transport)
  }
}

function isAuthError(err: unknown): boolean {
  if (err instanceof UnauthorizedError) return true
  if (err instanceof StreamableHTTPError && err.code === 401) return true
  // Some transport stacks wrap the 401 into a generic Error with a message.
  const msg = err instanceof Error ? err.message : ''
  return /\b401\b|unauthorized/i.test(msg)
}

async function safeClose(closable: { close: () => Promise<void> | void } | undefined): Promise<void> {
  if (!closable) return
  try {
    await closable.close()
  } catch {
    // ignore
  }
}
