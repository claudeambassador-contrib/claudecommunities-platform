# ccau — Claude Community AU CLI

A thin TypeScript CLI that connects to the Claude Community MCP server (`/mcp`) and exposes every tool — both read tools and admin-only write tools — as a subcommand. Auth uses Clerk OAuth (Dynamic Client Registration + PKCE), the same flow the server is already set up for.

## Install (local dev)

### With bun

```bash
cd cli
bun install

# Skip the build entirely — bun runs TypeScript natively:
bun src/index.ts --help

# Or build + link for a `ccau` binary on $PATH:
bun run build
bun link            # provides `ccau` on $PATH
# Quick one-off without linking:
bunx ccau --help
```

## Usage

```bash
# One-time: sign in. This opens a browser, runs OAuth, stores tokens under
# ~/.config/claudecommunity-cli/profiles/<server>/, and caches the tool list
# so `ccau --help` works offline-style from this point on.
ccau login

# Top-level help — shows the noun groups (feed, post, event, course, …)
ccau --help

# Drill into a group — shows the verbs
ccau feed --help

# Drill into a verb — shows the flags / positional args
ccau feed list --help

# Run it
ccau feed list -n 5
ccau feed list -n 5 -s general
ccau post get post_ogdb1xlm2m
ccau post like post_ogdb1xlm2m
ccau event list -u
ccau user me
ccau post create --content "Hello!" --space-id <id>
```

### When the server adds a new tool

The CLI is driven by a local cache populated at `login` time. If you don't see a tool you expect, refresh:

```bash
ccau refresh   # re-fetches tools/list and rewrites the cache
```

Tools the CLI doesn't have a friendly mapping for (e.g. a brand-new server tool) appear under `ccau raw <toolName> …` so nothing is locked out.

### Escape hatches

```bash
# Live tool list (hits the server, no caching)
ccau list

# Call any tool by raw MCP name with a JSON args blob
ccau call createEvent --args '{"title":"Test","startTime":"2026-06-01T18:00:00Z"}'
```

## Common flags

| Flag | Purpose |
| --- | --- |
| `-s, --server <url>` | Override the MCP server origin (default `https://claudecommunity.com.au`, also `CLAUDECOMMUNITY_CLI_URL`) |
| `--no-browser` | Don't auto-open a browser; print the URL and read the pasted redirect URL from stdin (for SSH / headless) |
| `--json` | Output the raw `tools/call` result as JSON instead of pretty text |

## Environment variables

| Var | Purpose |
| --- | --- |
| `CLAUDECOMMUNITY_CLI_URL` | Default MCP server origin (overrides defaults; overridden by `--server`) |
| `CCAU_STAGING` | If truthy (`1`, `true`, `yes`, `on`), point at `https://ccau.rockyshoreslabs.io` instead of prod |
| `XDG_CONFIG_HOME` | Override the config directory (defaults to `~/.config`) |

Server URL precedence: `--server` flag > `CLAUDECOMMUNITY_CLI_URL` > `CCAU_STAGING=1` > prod default. Tokens are stored per-server, so you can be signed in to prod and staging at the same time.

## How it works

* **MCP client**: `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk` against `<server>/mcp`.
* **OAuth**: `OAuthClientProvider` implementation in `src/oauth-provider.ts` stores tokens, PKCE verifier, and the registered client info under `~/.config/claudecommunity-cli/profiles/<slug>/` with mode 600. The SDK's built-in `auth()` machinery drives discovery (`.well-known/oauth-protected-resource/mcp` → `.well-known/oauth-authorization-server`), Dynamic Client Registration via `/oauth/register`, and the authorization-code exchange.
* **Callback**: an ephemeral loopback HTTP server on `127.0.0.1:11789/callback` receives the code. Port is fixed so the server's DCR dedupe (matching on `redirect_uris`) reuses the same Clerk OAuth app across runs.
* **Tool cache**: `ccau login` and `ccau refresh` fetch `tools/list` and write it to `~/.config/claudecommunity-cli/profiles/<slug>/tools.json`. Subsequent CLI invocations read this file synchronously at startup — no network round-trip just to render help or build the command tree.
* **Command tree**: `src/command-map.ts` maps each tool to a `{group, command, positional, shortFlags}` entry. The dispatcher walks the cached tool list and creates `program <group> <command>` for each — so `getFeed` becomes `ccau feed list`, `updatePost` becomes `ccau post update <postId>`, etc. Tools without a mapping land under `ccau raw <toolName>`.
* **Schema → flags**: `src/schema-to-flags.ts` translates each tool's JSON Schema into commander options/arguments. Required properties become mandatory; `string`, `number`, `integer`, `boolean`, and `enum` are all supported.

## File layout

```
src/
  index.ts             # entry; pre-parses --server, loads cache, builds tree
  config.ts            # server URL resolution, paths, redirect URI
  oauth-provider.ts    # token / client / PKCE persistence
  callback-server.ts   # ephemeral 127.0.0.1 listener for OAuth redirect
  client.ts            # MCP client factory + interactive auth orchestrator
  tool-cache.ts        # read/write of ~/.../tools.json
  command-map.ts       # tool name → noun/verb mapping
  schema-to-flags.ts   # JSON Schema → commander options + positional args
  commands/
    auth.ts            # login / logout / whoami / refresh
    dispatch.ts        # builds the noun/verb tree from cache + map
    tools.ts           # list (live) / call (raw by name)
```

## Adding a new server tool to the CLI

1. Add the tool to the server's `src/lib/mcp/tools.ts`.
2. Run `ccau refresh` — the new tool is reachable immediately as `ccau raw <toolName> --args '...'`.
3. (Optional, for a friendly name) add an entry to `COMMAND_MAP` in `src/command-map.ts`. No other changes required; the dispatcher picks it up next run.

## Known limitations

* **Cache must be populated.** First-time users must `ccau login` (or `ccau refresh` if already authenticated) before the noun/verb tree fills in. Until then, `ccau --help` prints a nudge to log in and only static commands work.
* **No image upload helper.** `ccau image upload-url ...` returns the curl command verbatim — you still have to run it yourself, then pass the URL into `ccau post create --image-url ...`.
* **Single port (11789).** If something else is bound to that port, OAuth login fails. Run `ccau login --no-browser` to fall back to pasting the redirect URL.
