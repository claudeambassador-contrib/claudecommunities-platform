# Authentication Configuration - Claude Community

This document provides authentication setup information for future agents working on claudecommunity.com.au.

## Overview

- **Authentication Provider**: Clerk (https://clerk.com)
- **Production Domain**: claudecommunity.com.au
- **Hosting**: Cloudflare Workers (via OpenNext) — see `wrangler.jsonc`
- **Database**: Cloudflare D1 (SQLite), binding `DB`

## Clerk Dashboard Access

- **Dashboard URL**: https://dashboard.clerk.com
- **Application**: Claude Community
- **App ID**: `app_39H1P4btQo3xef4S3DsfanaaMmo`

## Environment Variables (Cloudflare Worker)

The following environment variables / secrets are configured on the Worker
(`ccau` for production, `ccau-staging` for staging). Set with `wrangler secret put <NAME>`:

| Variable | Description |
|----------|-------------|
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key |
| `CLERK_JWT_ISSUER_DOMAIN` | JWT issuer used to verify Clerk tokens from the MCP server |

## Middleware Configuration

The Clerk middleware is configured in `src/middleware.ts`:

- **Static routes** (skip Clerk entirely): `/`, `/events`, `/professionals`, `/vibe-coders`, `/offline`
- **Public routes** (through Clerk but no auth required): login, signup, events, professionals, pricing, webhooks, cities
- **Protected routes**: Everything else requires authentication

## Clerk Instances

### Production Instance (CURRENT)

- **Instance ID**: `ins_39IVahzUqdHvMovcaeZePX6MoQV`
- **Domain**: `claudecommunity.com.au`
- **Frontend API URL**: `https://clerk.claudecommunity.com.au`
- **Publishable Key**: `pk_live_Y2xlcmsuY2xhdWRlY29tbXVuaXR5LmNvbS5hdSQ`
- **Dashboard URL**: https://dashboard.clerk.com/apps/app_39H1P4btQo3xef4S3DsfanaaMmo/instances/ins_39IVahzUqdHvMovcaeZePX6MoQV

### Development Instance

- **Instance ID**: `ins_39H1P5Zd6SdNhdUrAEPev1TpQuG`
- **Dashboard URL**: https://dashboard.clerk.com/apps/app_39H1P4btQo3xef4S3DsfanaaMmo/instances/ins_39H1P5Zd6SdNhdUrAEPev1TpQuG

## SSO/OAuth Setup

### Status: IN PROGRESS

To complete Google OAuth setup:

1. **Update Worker secrets** (if not done):
   - `wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_Y2xlcmsuY2xhdWRlY29tbXVuaXR5LmNvbS5hdSQ`
   - `wrangler secret put CLERK_SECRET_KEY` = Copy from Clerk Production API Keys page

2. **Configure Google OAuth in Clerk Production**:
   - Go to Clerk Production > Configure > SSO Connections
   - Add Google OAuth provider
   - Use your own Google OAuth credentials (from Google Cloud Console)

3. **Redeploy**:
   - `bun run staging:deploy` (or `production:deploy`)

## Browser Automation Notes

When making configuration changes, use `--chrome` flag with Claude Code for browser automation tasks:
- Cloudflare Dashboard: https://dash.cloudflare.com
- Clerk Dashboard: https://dashboard.clerk.com

## Database Information

- **Provider**: Cloudflare D1 (SQLite)
- **Binding**: `DB` — see `wrangler.jsonc`
- **Adapter**: `@prisma/adapter-d1`, resolved per-request via `getCloudflareContext().env.DB`
- **Prisma client**: `src/lib/prisma.ts`
- **Raw SQL helper**: `src/lib/db.ts` (SQLite-flavored, `?` placeholders)

## API Routes

### Events API
- `GET /api/events` - List all events
- `POST /api/events` - Create new event
- `GET /api/events/[id]` - Get single event
- `PUT /api/events/[id]` - Update event
- `DELETE /api/events/[id]` - Delete event
- `GET /api/events/[id]/rsvp` - Get RSVPs for event
- `POST /api/events/[id]/rsvp` - Create/update RSVP
- `DELETE /api/events/[id]/rsvp` - Remove RSVP

## Notes

- `src/middleware.ts` uses `clerkMiddleware` as the default export (not a manual `clerk(request, ...)` invocation).
- The Events API runs on Prisma + D1 (it previously ran on `better-sqlite3`, then briefly on Neon via Hyperdrive, before the project moved to D1).
- The MCP server (`/api/mcp`) verifies Clerk JWTs and uses `extra.userId` to look up the application user in D1.
