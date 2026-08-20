# Architecture Deepening Implementation Plan (apps/web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the shallow spots in `apps/web` into deep modules: an injectable (testable) session seam, a single error-presentation table, a city server-fn factory that removes ~115 copies of route boilerplate, module-owned zod validation, collapsed duplicate entity types, and one registry-plane entry path.

**Architecture:** All work is in `apps/web` (TanStack Start + Drizzle + D1). The layering stays route → shared/http → module service → module repository → store. We deepen four seams: (1) `sessionService` accepts its dependencies instead of creating them, (2) `guarded`/`guardedMutation` present errors through one table, (3) a `cityQuery`/`cityMutation` factory owns the server-fn wiring and permission checks move to services only, (4) modules own their zod write schemas and their canonical DTO types.

**Tech Stack:** TypeScript, TanStack Start (`createServerFn`), zod, drizzle-orm, vitest + better-sqlite3 (`:memory:`), Biome.

**Spec:** The architecture review report (candidates 1–7) at `/var/folders/hf/vx_qz7m10s794c4l4y3t_tkc0000gn/T/architecture-review-20260820-090222.html`. Candidate #8 (hypothetical seams) is explicitly out of scope — leave `SocialConnector`, `PublishStarter`, `registryStore`/`tenantStore` as they are.

## Global Constraints

- All commands run from `apps/web/` with **bun** (`bun run check`, `bun run test`, `bun run typecheck`, `bun run build`). All three of `check`, `test`, and `typecheck` must pass before every commit.
- Biome is at zero warnings; suppressions only with `// biome-ignore <rule>: <reason>`.
- Never touch the legacy Next.js app at the repo root (`/src`, `/prisma`, `/migrations`). Never touch `apps/web/src/routeTree.gen.ts` (generated).
- Behavior-preserving unless a task says otherwise: same HTTP statuses, same `Result` codes from services, same public exports where the task doesn't rename them.
- **Permission ruling (binding for Tasks 4–6):** permission checks live in the module **service** (`ensurePermission`), not in the route. Routes pass no permission to the factory **unless** the service function is deliberately public (e.g. `listPublicTiers`) and the route still needs a gate — then the route declares it via the factory's `permission` option. Before dropping a route's permission, verify every service call in the handler enforces a permission that is the same or stronger; if a service function lacks the check the route had, **add it to the service** (and update that module's service tests).
- Existing service tests (`test/**`) enter at `service(store, actor, input)` and must keep passing; update them only where a task renames types/fields.
- Commit per task with conventional-commit messages; never `git push`.
- The dev server may be running; do not start long-lived dev servers in subagents.

---

### Task 1: Injectable session seam (`sessionCore`) + tests

**Files:**
- Create: `apps/web/src/modules/identity/services/sessionCore.ts`
- Modify: `apps/web/src/modules/identity/services/sessionService.ts` (becomes the prod adapter, same exports)
- Test: `apps/web/test/identity/sessionCore.test.ts`

**Interfaces:**
- Consumes: `ttlMemo` (`@/shared/ttlMemo`), `usersRepo` (`findByClerkId`, `upsertFromClerk`, `findMembership`), `resolveCityContext` (`@/modules/tenants/services/publicListService`), `openMemoryRegistry` (`test/helpers/registry.ts`).
- Produces: `createSessionService(deps: SessionDeps): SessionService` and types `SessionDeps`, `ClerkProfile`, `SessionService` from `sessionCore.ts`. `sessionService.ts` keeps exporting `syncSessionUser`, `buildCityRouteContext`, `actorFromAuth`, `requirePermission`, `hasAnyAdminPermission` with **unchanged signatures** so no caller changes.

The current `sessionService.ts` hard-binds Clerk (`auth()`, `clerkClient()`), `cloudflare:workers` env (via `@/shared/db/env`), and two module-level 60s memos — so its ban re-check and memo-staleness logic (the riskiest auth code in the app) has zero unit tests, and vitest can't even import the file (top-level `cloudflare:workers` import chain).

- [ ] **Step 1: Create `sessionCore.ts`** — move ALL logic out of `sessionService.ts` into a dependency-injected core. No imports of `@clerk/*` or `@/shared/db/env` in this file. Shape:

```typescript
import type { Actor } from "@/shared/auth/actor";
import { hasPermission, type Permission, permissionsForRole } from "@/shared/auth/permissions";
import type { RegistryDb } from "@/shared/db/client";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import type { AuthContext, RouteContext, TenantContext } from "@/shared/http/routeContext";
import type { ttlMemo } from "@/shared/ttlMemo";

/** The slice of a Clerk user the session sync actually reads. */
export interface ClerkProfile {
  emailAddresses: { emailAddress: string }[];
  firstName: string | null;
  id: string;
  imageUrl: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  username: string | null;
}

export interface SessionDeps {
  cityMemo: ReturnType<typeof ttlMemo<TenantContext>>;
  /** null = Clerk unavailable or user fetch failed → treat as unauthenticated. */
  getProfile(userId: string): Promise<ClerkProfile | null>;
  /** null = no signed-in session. Wraps Clerk's auth(); must never throw. */
  getSessionUserId(): Promise<string | null>;
  isConfigured(): boolean;
  openTenantStore(tenant: TenantContext): TenantStore;
  sessionMemo: ReturnType<typeof ttlMemo<AuthContext>>;
}

export interface SessionService {
  buildCityRouteContext(registryDb: RegistryDb, citySlug: string): Promise<Result<{ ctx: RouteContext }>>;
  syncSessionUser(db: RegistryDb): Promise<Result<{ auth: AuthContext }>>;
}

export function createSessionService(deps: SessionDeps): SessionService { /* moved logic */ }
```

Port the existing logic **verbatim in behavior**: memo-hit path re-checks `isBanned`/`isSuperAdmin` against the registry and evicts on ban; vanished-row falls through to full re-sync; missing email → `err("missing_email", 400)`; `buildCityRouteContext` runs tenant resolution and session sync in parallel and maps role → permissions (`isSuperAdmin` ⇒ `permissionsForRole("owner")`). `readClerkUser`/`resolveTenant` become internal functions using `deps.getProfile` / `deps.cityMemo`. Note the one signature change: the core's `buildCityRouteContext` takes `registryDb` as a parameter (the prod adapter supplies it) — this is what makes the core importable in vitest.

Also move the pure helpers `actorFromAuth`, `requirePermission`, `hasAnyAdminPermission` into `sessionCore.ts` unchanged.

- [ ] **Step 2: Rewrite `sessionService.ts` as the prod adapter.** It keeps every current export name/signature so `cityPage.ts` and all other importers compile untouched:

```typescript
import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import {
  actorFromAuth, type ClerkProfile, createSessionService, hasAnyAdminPermission,
  requirePermission, type SessionService,
} from "@/modules/identity/services/sessionCore";
import { isClerkServerConfigured } from "@/shared/auth/clerk";
import { getRegistryDb, openTenantStore, workerEnv } from "@/shared/db/env";
import { ttlMemo } from "@/shared/ttlMemo";
// ... type-only re-imports as needed

export { actorFromAuth, hasAnyAdminPermission, requirePermission };

const sessionMemo = ttlMemo<AuthContext>(60_000);
const cityMemo = ttlMemo<TenantContext>(60_000);

let service: SessionService | undefined;
function prodService(): SessionService {
  service ??= createSessionService({
    cityMemo,
    async getProfile(userId) {
      try {
        const client = await clerkClient();
        return (await client.users.getUser(userId)) as unknown as ClerkProfile;
      } catch { return null; }
    },
    async getSessionUserId() {
      try {
        const session = await auth();
        return session.isAuthenticated && session.userId ? session.userId : null;
      } catch { return null; }
    },
    isConfigured: () => isClerkServerConfigured(workerEnv()),
    openTenantStore,
    sessionMemo,
  });
  return service;
}

export function syncSessionUser(db: RegistryDb) { return prodService().syncSessionUser(db); }
export function buildCityRouteContext(citySlug: string) {
  return prodService().buildCityRouteContext(getRegistryDb(), citySlug);
}
```

Grep first: `grep -rn "from \"@/modules/identity/services/sessionService\"" src/ test/` — every current importer must still compile with zero edits (if one imports something you moved, re-export it from `sessionService.ts`).

- [ ] **Step 3: Write the failing tests** in `test/identity/sessionCore.test.ts` using `openMemoryRegistry()` and a `makeDeps(overrides)` helper that returns real `ttlMemo`s + stub `getProfile`/`getSessionUserId`. Seed users through `usersRepo.upsertFromClerk` and flip flags with drizzle updates on `registry.tables.users`. Required cases (each an `it`):
  1. fresh sign-in upserts the user and returns `AuthContext` with `role: null` permissions
  2. banned user on **fresh** sync → `err("banned", 403)` and nothing cached
  3. banned user on **memo hit** → `err("banned", 403)` AND the memo entry is evicted (subsequent call with unbanned row does a full re-sync — assert `getProfile` called again)
  4. memo hit refreshes `isSuperAdmin` from the registry (cache says false, row says true → returned auth has true)
  5. registry row deleted after caching → falls through to full re-sync (asserts `getProfile` called a second time)
  6. `isConfigured() === false` → `err("unauthenticated", 401)` without calling `getSessionUserId`
  7. Clerk profile with no email addresses → `err("missing_email", 400)`
  8. memo expiry: `vi.useFakeTimers()`, sync, advance `61_000` ms, sync again → full re-sync path taken (memo uses `Date.now`)
  9. `buildCityRouteContext`: member role maps to member permissions; `isSuperAdmin` maps to owner permissions; no session → `ctx.auth === null` while tenant still resolves
  10. `cityMemo` staleness: resolve city, rename the tenant row, resolve again within TTL → stale name; after `61_000` ms → fresh name

  For case 9/10 you need a city row in the registry — inspect `resolveCityContext` and `registrySchema.ts` to seed the minimal rows it queries. Stub `openTenantStore` to return `openMemoryTenant()` from `test/helpers/tenant.ts`.

- [ ] **Step 4: Run the new tests, watch them fail** (before Step 1–2 are complete — do Steps 3→1→2→5 in TDD order if you prefer; either order is fine as long as you observe a red run first): `bun run test test/identity/sessionCore.test.ts`
- [ ] **Step 5: Make them pass**, then run the full gates: `bun run test && bun run check`
- [ ] **Step 6: Commit** — `refactor(web): extract injectable sessionCore seam with ban/memo tests`

---

### Task 2: One error-presentation table (`presentError`)

**Files:**
- Create: `apps/web/src/shared/http/presentError.ts`
- Modify: `apps/web/src/shared/http/guarded.ts`, `apps/web/src/shared/ui/page.tsx` (DeniedCard), any client code branching on `data.reason`
- Test: `apps/web/test/shared/presentError.test.ts`, extend `apps/web/test/shared/guarded.test.ts`

**Interfaces:**
- Consumes: `ServiceError` from `@/shared/http/errors`.
- Produces: `presentError(error: ServiceError): string`; `Denied` gains `code: string` while `reason` becomes the human message. Later tasks rely on `guarded`/`guardedMutation` both routing through `presentError`.

Today the same `ServiceError` renders three ways: `guarded` (GET) leaks the raw code to users (`not_found`, `forbidden` shown verbatim in `DeniedCard`), `guardedMutation` (POST) shows `message ?? code`, and client-side throws collapse to a generic string.

- [ ] **Step 1: Write failing tests** for `presentError`: explicit `message` wins; known code without message maps to its table entry (`forbidden` → "You don't have permission to do that.", `unauthenticated` → "Sign in to continue.", `not_found` → "That page or record doesn't exist.", `banned` → "This account has been suspended.", `bad_request`/`invalid_input` → "That input couldn't be saved. Check the fields and try again.", `conflict` → "That already exists — pick a different name.") ; unknown code without message → "Something went wrong. Please try again."
- [ ] **Step 2: Implement:**

```typescript
import type { ServiceError } from "./errors";

const MESSAGES: Record<string, string> = {
  bad_request: "That input couldn't be saved. Check the fields and try again.",
  banned: "This account has been suspended.",
  conflict: "That already exists — pick a different name.",
  forbidden: "You don't have permission to do that.",
  invalid_input: "That input couldn't be saved. Check the fields and try again.",
  not_found: "That page or record doesn't exist.",
  unauthenticated: "Sign in to continue.",
};

export function presentError(error: ServiceError): string {
  return error.message ?? MESSAGES[error.code] ?? "Something went wrong. Please try again.";
}
```

- [ ] **Step 3: Wire it into `guarded.ts`.** `Denied` becomes `{ allowed: false; code: string; reason: string }` where `code` is the machine code (old `reason` value) and `reason` is now `presentError(error)`. All four early-return sites in `guarded` populate both. `guardedMutation`'s error string becomes `presentError(result.error)` (and `presentError({code:"unauthenticated",status:401})` for the auth short-circuit). **First grep for client code that branches on the old codes**: `grep -rn "\.reason ===\|reason ===" src/routes src/shared/ui` — switch any match to `.code ===`. `DeniedCard` keeps rendering `reason` (now human).
- [ ] **Step 4: Run gates:** `bun run test && bun run check`
- [ ] **Step 5: Commit** — `feat(web): present service errors through one message table`

---

### Task 3: `cityQuery` / `cityMutation` factory — prototype on the tiers route

**Files:**
- Create: `apps/web/src/shared/http/cityFn.ts`
- Modify: `apps/web/src/routes/$citySlug/admin/tiers.tsx`
- Test: `apps/web/test/shared/cityFn.test.ts` (schema-merging unit tests; the guarded path is already covered)

**Interfaces:**
- Consumes: `guarded`, `guardedMutation`, `GuardedPage` from `@/shared/http/guarded`; zod.
- Produces (later batch tasks rely on these exact signatures):

```typescript
export function cityQuery<S extends z.ZodRawShape, T extends object>(opts: {
  handler: (page: GuardedPage, data: z.infer<z.ZodObject<S>> & { citySlug: string }) => Promise<Result<T>>;
  input?: S;
  permission?: Permission | null;
}): /* server fn callable as fn({ data: { citySlug, ...input } }) returning Promise<Guarded<T>> */;

export function cityMutation<S extends z.ZodRawShape, T extends object = Empty>(opts: {
  handler: (page: GuardedPage, data: z.infer<z.ZodObject<S>> & { citySlug: string }) => Promise<Result<T>>;
  input?: S;
  permission?: Permission | null;
}): /* server fn returning Promise<Mutated<T>> */;
```

The shape `zod object with citySlug → createServerFn → .validator → guarded → service` is hand-copied ~115× across routes (115 `citySlug: z.string().min(1)` declarations, 116 `.validator(...)`, 40 DeniedCard branches). The factory concentrates the wiring once.

**⚠ Load-bearing risk — TanStack Start compilation.** `createServerFn(...).handler(...)` calls are compiler-extracted so server-only code is stripped from the client bundle. Calling `.handler()` inside `cityFn.ts` with a closure passed from a route file may defeat that stripping. This task's job is to settle it empirically:

- [ ] **Step 1: Implement the full factory** in `cityFn.ts`: build `z.object({ citySlug: z.string().min(1), ...(opts.input ?? {}) })`, then `createServerFn({ method: "GET" }).validator((input: unknown) => schema.parse(input)).handler(({ data }) => guarded(data.citySlug, opts.permission ?? null, (page) => opts.handler(page, data)))` (POST + `guardedMutation` for `cityMutation`).
- [ ] **Step 2: Convert `tiers.tsx`** to it. Target shape (this is the worked example every batch task copies — note the permission ruling from Global Constraints: no `permission:` option, because `listTiers`/`createTier` already call `ensurePermission` internally):

```typescript
const loadTiers = cityQuery({
  handler: (page) => listTiers(page.store, page.actor),
});

const submitTier = cityMutation({
  input: {
    description: z.string(),
    name: z.string(),
    price: z.number(),
    yearlyPrice: z.number().nullable(),
  },
  handler: (page, data) =>
    createTier(page.store, page.actor, {
      description: data.description,
      name: data.name,
      price: data.price,
      yearlyPrice: data.yearlyPrice,
    }),
});
```

  The loader call site (`loadTiers({ data: { citySlug: params.citySlug } })`) and the component stay as-is. Where the old handler re-wrapped a service result in `ok({...})` just to rename nothing, return the service result directly.
- [ ] **Step 3: Verify the compilation risk.** `bun run build` must succeed. Then inspect the **client** assets for server leakage: `grep -rl "tiersRepository\|drizzle\|cloudflare:workers" dist/client/ .output/public/ 2>/dev/null || true` (locate the client output dir first; also confirm the tiers page JS chunk doesn't grow suspiciously). Run `bun run test && bun run check`, then a dev smoke: `timeout 30 bun run dev` long enough to confirm boot without errors is NOT required if build+tests pass — skip dev smoke if `bun run build` is green.
- [ ] **Step 4 (fallback, only if Step 3 fails):** keep `createServerFn` in the route file and reduce the factory to two helpers exported from `cityFn.ts`: `cityInput<S>(shape: S)` returning the merged zod object, and `cityHandler(permission, fn)` returning the `({ data }) => guarded(...)` handler body. Convert `tiers.tsx` to that instead, and record in your report that the fallback shape won — batch tasks will follow whichever shape this task lands.
- [ ] **Step 5: Unit-test the schema merge** (extra input fields required, citySlug always required, bad input throws ZodError).
- [ ] **Step 6: Commit** — `feat(web): cityQuery/cityMutation server-fn factory, tiers as pilot`

---

### Task 4: Migrate `$citySlug/admin/**` routes to the factory (batch 1, ~30 files)

**Files:**
- Modify: every `apps/web/src/routes/$citySlug/admin/**/*.tsx` (list them with `ls`), except `tiers.tsx` (done in Task 3)

**Interfaces:**
- Consumes: `cityQuery`/`cityMutation` exactly as landed by Task 3 (read `apps/web/src/shared/http/cityFn.ts` and `tiers.tsx` first — they are the authoritative shape, including whether the fallback form won).

Recipe per file:
1. Replace each `createServerFn(...).validator(...).handler(({data}) => guarded(...))` with `cityQuery({ input?, handler })`; POST + `guardedMutation` → `cityMutation`. Extra zod fields (everything except `citySlug`) move into `input:`.
2. **Permission audit (Global Constraints ruling):** the old second argument to `guarded` was a permission. Open every service function the handler calls and confirm it starts with `ensurePermission(actor, <same or stronger permission>)`. If yes → omit `permission:`. If a called service function has NO check but the route had one → add `ensurePermission` to that service function (matching the route's old permission) and extend that module's service test with a `memberActor()` forbidden case. If the service is deliberately public (name starts with `listPublic`/serves visitor pages) and the route still gated it → keep `permission:` in the factory options and note it in your report.
3. Drop now-unused imports (`createServerFn`, `guarded`, `ok` where no longer used, the standalone `z.object` input consts). Keep `z` where `input:` uses it.
4. Do not restructure components, forms, or loaders beyond the server-fn block.

- [ ] **Step 1: Convert all files** per the recipe (work through the directory alphabetically; run `bun run typecheck` every ~8 files to catch drift early)
- [ ] **Step 2: Run gates:** `bun run test && bun run check`
- [ ] **Step 3: Verify no stragglers in the batch:** `grep -rln "guarded(\|guardedMutation(" src/routes/\$citySlug/admin/` → must be empty
- [ ] **Step 4: Commit** — `refactor(web): admin routes onto cityQuery/cityMutation, permissions single-sourced in services`

---

### Task 5: Migrate `$citySlug/community/**` + `$citySlug/profile*` + `$citySlug/settings*` routes (batch 2)

**Files:**
- Modify: every remaining factory-eligible file in `apps/web/src/routes/$citySlug/community/**`, plus profile/settings routes under `$citySlug/` (enumerate with `grep -rln "createServerFn" src/routes/\$citySlug/community src/routes/\$citySlug/profile* src/routes/\$citySlug/settings* 2>/dev/null`)

Same recipe, same permission audit, same interfaces as Task 4 (read `cityFn.ts` + `tiers.tsx` first). Community routes serve signed-in members rather than admins — expect more `permission: null`-style public/list service calls; the audit rule still applies: the service owns the check, or the route keeps an explicit `permission:` with a report note.

- [ ] **Step 1: Enumerate + convert** all matched files
- [ ] **Step 2: Run gates:** `bun run test && bun run check`
- [ ] **Step 3: Verify:** `grep -rln "guarded(\|guardedMutation(" <the batch dirs>` → empty
- [ ] **Step 4: Commit** — `refactor(web): community/profile routes onto cityFn factory`

---

### Task 6: Migrate all remaining `$citySlug/**` routes (batch 3: events, courses, impact-lab, talks, index, everything left)

**Files:**
- Modify: every file left in `apps/web/src/routes/$citySlug/**` still importing `guarded`/`guardedMutation` directly (enumerate with `grep -rln "from \"@/shared/http/guarded\"" src/routes/\$citySlug/`)

Same recipe and audit as Task 4. These are mostly public/member-facing pages that already pass `null` permissions — the conversion is mechanical.

- [ ] **Step 1: Enumerate + convert**
- [ ] **Step 2: Run gates:** `bun run test && bun run check`
- [ ] **Step 3: Verify:** `grep -rln "guarded(\|guardedMutation(" src/routes/` → empty (only `cityFn.ts` may import guarded now)
- [ ] **Step 4: Commit** — `refactor(web): remaining city routes onto cityFn factory`

---

### Task 7: Module-owned zod write schemas — tiers, events, talks

**Files:**
- Create: `apps/web/src/modules/tiers/schemas.ts`, `apps/web/src/modules/events/schemas.ts`, `apps/web/src/modules/talks/schemas.ts`
- Modify: `apps/web/src/modules/tiers/services/tiersService.ts` (delete `parseNonNegative`/`parseOptionalNonNegative`/`validateInput`), `apps/web/src/modules/events/validators.ts` → fold into `schemas.ts` and delete, `apps/web/src/modules/talks/validators.ts` → same; the routes whose `input:` shapes duplicate these fields
- Test: extend `apps/web/test/tiers/tiersService.test.ts` (and events/talks equivalents) with invalid-input cases hitting the zod path

**Interfaces:**
- Produces the convention later tasks and modules follow: each module exports `<entity>WriteInput` (a `z.ZodObject`) and `type <Entity>WriteInput = z.infer<...>` from `modules/<x>/schemas.ts`. Services call `safeParse` and map failure to `err("bad_request", 400, firstIssueMessage)`. Routes reuse the module schema's fields in the factory's `input:` (e.g. `input: tierWriteInput.shape` or a `.pick()` of it) instead of restating them.

Worked example for tiers (port `validateInput`'s exact rules — trim, non-negative, optional yearly, features array of trimmed strings, `order` non-negative int; keep `toSafeSlug` derivation in the service after parse):

```typescript
import { z } from "zod";

export const tierWriteInput = z.object({
  color: z.string().trim().optional(),
  description: z.string().trim().optional(),
  features: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1, "Tier name is required"),
  order: z.number().int().min(0, "order must be an integer ≥ 0").optional(),
  price: z.coerce.number().min(0, "price must be a number ≥ 0").default(0),
  slug: z.string().optional(),
  yearlyPrice: z.coerce.number().min(0, "yearlyPrice must be a number ≥ 0").nullable().default(null),
});
export type TierWriteInputParsed = z.infer<typeof tierWriteInput>;
```

Service side: `const parsed = tierWriteInput.safeParse(input); if (!parsed.success) return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");` then build `TierWrite` from `parsed.data` (+ slug derivation, `?? null` normalizations). Preserve every existing error message string that a test asserts on, or update the test alongside.

For events/talks: translate the hand-rolled `validators.ts` checks (URL allow-lists etc.) into zod (`z.string().url().refine(...)`), keeping identical accept/reject behavior; delete the old validator file; update importers.

- [ ] **Step 1: tiers** — schema, service swap, red-green on new invalid-input tests, route `input:` reuse in `tiers.tsx`
- [ ] **Step 2: events** — port `events/validators.ts` to `events/schemas.ts`, update `eventsService` callers, delete old file
- [ ] **Step 3: talks** — same
- [ ] **Step 4: Run gates:** `bun run test && bun run check`
- [ ] **Step 5: Commit** — `refactor(web): module-owned zod write schemas for tiers/events/talks`

---

### Task 8: Module-owned zod schemas — pages + social (delete the hand-rolled predicate files)

**Files:**
- Create: `apps/web/src/modules/pages/schemas.ts`, `apps/web/src/modules/social/schemas.ts`
- Modify/Delete: `apps/web/src/modules/pages/validators.ts` (269 L of `isObj`/`isOptStr` predicates — delete after porting), `apps/web/src/modules/social/validators.ts` (same), their service callers, any route `input:` duplication
- Test: existing `test/pages/*` and `test/social/*` suites must keep passing; add one invalid-input case per ported schema if none exists

Same convention as Task 7. These two are the largest hand-rolled validators; translate rule-for-rule (nullable vs optional, string trimming, enum sets, media constraints) — behavior-preserving, verified by the existing service tests. Where a validator function returned a discriminated result consumed by the service, keep the service's external `Result` behavior identical.

- [ ] **Step 1: pages** — port, swap, delete
- [ ] **Step 2: social** — port, swap, delete
- [ ] **Step 3: Run gates:** `bun run test && bun run check` (also `grep -rn "isOptStr\|isObj(" src/modules` → empty)
- [ ] **Step 4: Commit** — `refactor(web): pages/social validation onto zod module schemas`

---

### Task 9: Collapse duplicate entity types — events pilot (kill the imageUrl/coverUrl drift)

**Files:**
- Modify: `apps/web/src/modules/events/types.ts`, `apps/web/src/modules/events/services/eventsService.ts`, `apps/web/src/modules/events/repositories/eventsRepository.ts`, `apps/web/src/modules/system/services/mcpService.ts` (events tools), `apps/web/src/routes/$citySlug/events/$slug/index.tsx` (delete route-local `AgendaRow`), other events routes as needed
- Test: `apps/web/test/events/*` updated to renamed fields

Today `types.ts` declares the same concept three ways — `EventCreateBody`, `EventWrite`, `EventDetail` — and they drift: the cover image is `imageUrl` in `EventCreateBody`/`EventDetail` but `coverUrl` in `EventWrite`, hand-remapped in `eventsService.ts` (`coverUrl: input.imageUrl`). Tracing one field (`footerText`) touches 15 sites in 5 files.

- [ ] **Step 1: Pick the canonical field name from the DB column** in `schema.tenant.ts` (whichever of `coverUrl`/`imageUrl` the events table actually uses) and rename the other everywhere in the module, `mcpService`, routes, and tests. **Exception:** if the name is exposed through the MCP tool input schema (external contract), keep the MCP-facing name at the MCP layer with a single explicit translation and a comment — do not silently break MCP clients.
- [ ] **Step 2: Collapse the input types.** `EventCreateBody` and `EventWrite` merge into one write type derived from the Task 7 zod schema (`z.infer<typeof eventWriteInput>` + repo-level normalizations). `EventDetail` stays but must be produced in exactly ONE place (the repo's `toDetail`), and every route consumes it as-is — delete the route-local `AgendaRow` interface + field-by-field remap in `events/$slug/index.tsx`, using the module's published agenda type instead. Same for any other events route re-projection.
- [ ] **Step 3: Run gates:** `bun run test && bun run check`
- [ ] **Step 4: Commit** — `refactor(web): single write type + canonical field names for events`

---

### Task 10: Collapse duplicate types — tiers, and delete the social route re-projection

**Files:**
- Modify: `apps/web/src/modules/tiers/types.ts` (merge `TierInput`/`TierWrite`; `TierSummary` produced only by the repo), `tiersService.ts`, `tiersRepository.ts`, `apps/web/src/routes/$citySlug/admin/social/index.tsx` (delete local `ComposerAccount` + remap, consume the social module's published summary type)
- Test: `apps/web/test/tiers/*` updated

Apply the Task 9 pattern: `TierInput` (pre-validation) is replaced by the Task 7 zod-inferred type; `TierWrite` remains only if the repo genuinely needs a normalized shape distinct from the parsed input — if its fields are identical, delete it and use the parsed type. Grep for remaining route-local `interface` declarations that mirror a module DTO (`grep -rn "^interface \|^type .*= {" src/routes/ | grep -v Props`) and remove any that duplicate a published module type; list survivors (genuinely view-specific shapes) in your report.

- [ ] **Step 1: tiers types merge**
- [ ] **Step 2: social/index.tsx re-projection removal + sweep**
- [ ] **Step 3: Run gates:** `bun run test && bun run check`
- [ ] **Step 4: Commit** — `refactor(web): collapse tier type triple, drop route DTO re-projections`

---

### Task 11: One registry-plane entry path

**Files:**
- Create: `apps/web/src/shared/http/registryPage.ts`
- Modify: `apps/web/src/routes/index.tsx`, `apps/web/src/routes/pricing.tsx`, `apps/web/src/routes/sitemap.tsx`, `apps/web/src/routes/admin/index.tsx`, `apps/web/src/routes/oauth/register.ts`, `apps/web/src/routes/api/webhooks/resend.ts` (use `openTenantStore` instead of the hand-built store), other `src/routes` (non-`$citySlug`) files importing `@/shared/db/env` directly — enumerate with `grep -rln "shared/db/env" src/routes/`
- Test: `apps/web/test/shared/registryPage.test.ts` (context shape with/without session, via injected deps or `vi.mock` of `sessionService` — match the existing `guarded.test.ts` style)

**Interfaces:**
- Produces:

```typescript
export interface RegistryPageContext {
  auth: AuthContext | null;   // null when signed out — never an error for public pages
  registry: RegistryStore;
}
export async function loadRegistryPage(): Promise<RegistryPageContext>;
```

The 14 non-`$citySlug` sites currently each reconstruct their own context (`getRegistryDb()`/`workerEnv()` directly, lazy `await import("@/shared/db/env")`, a hand-built `TenantStore` in the resend webhook). `loadRegistryPage` = `getRegistryStore()` + `syncSessionUser` (unauthenticated → `auth: null`, banned → propagate as null too for public pages — the page-level admin gate re-checks). Migrate the page routes onto it. For `api/webhooks/resend.ts`: replace the hand-built tenant store with the existing `openTenantStore(tenant)` from `@/shared/db/env` (it already accepts `Pick<TenantContext, "orgId" | "d1Binding">`); webhook auth (secret verification) stays exactly as-is. API routes with genuinely different transport needs (upload, mcp, files) keep direct access but must go through named helpers in `@/shared/db/env` — no inline `env` poking; add a small helper there if one is missing.

- [ ] **Step 1: Implement + test `loadRegistryPage`**
- [ ] **Step 2: Migrate the page routes + webhook store**
- [ ] **Step 3: Run gates:** `bun run test && bun run check`; verify `grep -rln "await import(\"@/shared/db/env\")" src/routes/` → empty
- [ ] **Step 4: Commit** — `refactor(web): loadRegistryPage unifies the registry-plane routes`
