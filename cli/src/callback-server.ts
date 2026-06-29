import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { CALLBACK_PATH, CALLBACK_PORT } from './config.js'

export interface CallbackResult {
  code: string
  state?: string
}

/**
 * Spin up a one-shot loopback HTTP server that resolves with the OAuth
 * authorization code as soon as the user is redirected back to it.
 *
 * Bound to 127.0.0.1 only — never exposes the port to the network.
 */
export function awaitOAuthCallback(): { promise: Promise<CallbackResult>; close: () => void } {
  let server: Server
  const promise = new Promise<CallbackResult>((resolve, reject) => {
    server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400).end()
        return
      }
      const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`)
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404).end('Not found')
        return
      }
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const errorDescription = url.searchParams.get('error_description')
      const state = url.searchParams.get('state') ?? undefined

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderHtml(false, errorDescription || error))
        reject(new Error(`OAuth error: ${error}${errorDescription ? ` — ${errorDescription}` : ''}`))
        return
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderHtml(false, 'No authorization code returned.'))
        reject(new Error('OAuth callback missing code'))
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderHtml(true))
      resolve({ code, state })
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Callback port ${CALLBACK_PORT} is already in use. Close whatever is bound to it and rerun, or run with --no-browser to paste the code manually.`,
          ),
        )
      } else {
        reject(err)
      }
    })

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind callback server'))
      }
    })
  })

  return {
    promise,
    close: () => {
      try {
        server?.close()
      } catch {
        // ignore
      }
    },
  }
}

function renderHtml(success: boolean, message?: string): string {
  const title = success ? 'Signed in' : 'Sign-in failed'
  const body = success
    ? 'You can close this tab and return to your terminal.'
    : message ?? 'Something went wrong.'
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px system-ui;margin:0;padding:64px;display:flex;flex-direction:column;align-items:center;gap:16px;color:#111}h1{margin:0;font-size:22px}p{margin:0;color:#444;max-width:480px;text-align:center}</style>
</head><body><h1>${title}</h1><p>${escapeHtml(body)}</p></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
