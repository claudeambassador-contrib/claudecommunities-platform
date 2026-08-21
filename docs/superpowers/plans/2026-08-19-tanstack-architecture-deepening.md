# TanStack App Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the shallow spots in `apps/web` found by the 2026-08-19 architecture review: one `guarded()` route interface, cron/workflow behind the social seam, no ambient env in services, session memoisation, a real upload module, repo hygiene, and shim removal.

**Architecture:** The app is `src/modules/<domain>/` with `schema → repositories → services → routes`, one D1 per city (`TenantStore`), a REGISTRY D1 (`RegistryStore`/`RegistryDb`), and TanStack Start file routes calling `createServerFn` handlers. Services take `(store, actor, input)` and return `Result<T>`. Tests are vitest with in-memory sqlite fakes (`test/helpers/tenant.ts` → `openMemoryTenant()`, `test/helpers/registry.ts` → `openMemoryRegistry()`).

**Tech Stack:** TanStack Start (Vite) on Cloudflare Workers, Drizzle ORM (D1/sqlite), Clerk, Biome, vitest, Bun.

**Spec:** The architecture review report (candidates 1–7). Its findings are restated fully inside each task below — the tasks are self-contained.

## Global Constraints

- All commands run from `apps/web/`: `bun run test` (vitest), `bun run check` (biome + tsc). Both must pass before every commit.
- Package manager is **Bun**. Never npm/npx; use `bunx` if needed.
- Services keep the `(store, actor, input) => Promise<Result<T>>` shape; `Result`/`ok`/`err` come from `@/shared/http/errors`.
- Never import `cloudflare:workers` outside `src/shared/db/env.ts`, `src/start.ts`, `src/server.ts`, `src/workflows/*`, `src/worker-scheduled.ts`.
- Do not change `src/routeTree.gen.ts` by hand (it is generated).
- Do not touch anything outside `apps/web/` except this plan file.
- Existing client components check `data.allowed` — the denied payload shape `{ allowed: false, reason: string }` must be preserved exactly.
- Biome style: double quotes, semicolons, trailing commas, 2-space indent. `bun run check` enforces it.
- Commit after each task (or batch) with a conventional message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `guarded()` — one deep route-guard interface

**Files:**

- Create: `src/shared/http/guarded.ts`
- Create: `test/shared/guarded.test.ts`
- Modify: `src/routes/$citySlug/admin/courses/index.tsx` (exemplar conversion)

**Interfaces:**

- Consumes: `loadCityPage(citySlug)` from `@/shared/http/cityPage` (returns `Result<CityPageContext>` where `CityPageContext = { actor: Actor | null; auth; ctx; registry; store; tenant }`), `ensurePermission(actor, permission)` from `@/shared/auth/actor`, `Result`/`ok` from `@/shared/http/errors`, `Permission` type from `@/shared/auth/permissions`.
- Produces: `guarded<T>(citySlug, permission, fn)` and types `Guarded<T>`, `GuardedPage`. Tasks 2 and 3 convert routes to call it. Exact signature below.

- [ ] **Step 1: Write the failing test**

```ts
// test/shared/guarded.test.ts
import { describe, expect, it, vi } from "vitest";
import { ok, err, type Result } from "@/shared/http/errors";

// guarded() calls loadCityPage internally; mock the module seam.
vi.mock("@/shared/http/cityPage", () => ({
  loadCityPage: vi.fn(),
}));

import { loadCityPage } from "@/shared/http/cityPage";
import { guarded } from "@/shared/http/guarded";

const actor = {
  id: "usr_1",
  email: "a@b.c",
  isSuperAdmin: false,
  permissions: new Set(["courses.view"]) as ReadonlySet<never>,
};

function page(overrides: object = {}) {
  return ok({
    actor,
    auth: null,
    ctx: {} as never,
    registry: {} as never,
    store: {} as never,
    tenant: { slug: "sydney" } as never,
    ...overrides,
  });
}

describe("guarded", () => {
  it("denies when the page fails to load", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(err("not_found", 404) as never);
    const result = await guarded("sydney", null, async () => ok({ x: 1 }));
    expect(result).toEqual({ allowed: false, reason: "not_found" });
  });

  it("denies unauthenticated (no actor)", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page({ actor: null }) as never);
    const result = await guarded("sydney", null, async () => ok({ x: 1 }));
    expect(result).toEqual({ allowed: false, reason: "unauthenticated" });
  });

  it("denies a missing permission with reason 'forbidden'", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page() as never);
    const result = await guarded("sydney", "events.edit", async () => ok({ x: 1 }));
    expect(result).toEqual({ allowed: false, reason: "forbidden" });
  });

  it("maps a service error to denied", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page() as never);
    const result = await guarded(
      "sydney",
      null,
      async () => err("invalid_input", 400) as Result<{ x: number }>,
    );
    expect(result).toEqual({ allowed: false, reason: "invalid_input" });
  });

  it("returns the payload flattened with allowed: true", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page() as never);
    const result = await guarded("sydney", "courses.view", async (p) => {
      expect(p.actor.id).toBe("usr_1");
      return ok({ courses: [1, 2] });
    });
    expect(result).toEqual({ allowed: true, courses: [1, 2] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test -- test/shared/guarded.test.ts`
Expected: FAIL — `Cannot find module '@/shared/http/guarded'` (or equivalent).

Note: if vitest cannot resolve `test/shared/`, check `vitest.config.ts` `include` covers `test/**/*.test.ts` (it does today).

- [ ] **Step 3: Implement `guarded()`**

```ts
// src/shared/http/guarded.ts
import { type Actor, ensurePermission } from "@/shared/auth/actor";
import type { Permission } from "@/shared/auth/permissions";
import { type CityPageContext, loadCityPage } from "@/shared/http/cityPage";
import type { Result } from "@/shared/http/errors";

/** A loaded city page with a signed-in actor — what a guarded handler receives. */
export type GuardedPage = CityPageContext & { actor: Actor };

export type Denied = { allowed: false; reason: string };
export type Guarded<T> = ({ allowed: true } & T) | Denied;

/**
 * The one route-guard interface for admin server fns: loads the city page,
 * requires a signed-in actor, checks the permission (when given), runs the
 * handler, and maps any Err into the `{ allowed: false, reason }` shape the
 * client's DeniedCard already understands.
 */
export async function guarded<T extends object>(
  citySlug: string,
  permission: Permission | null,
  fn: (page: GuardedPage) => Promise<Result<T>>,
): Promise<Guarded<T>> {
  const page = await loadCityPage(citySlug);
  if (!page.ok) {
    return { allowed: false, reason: page.error.code };
  }
  if (!page.actor) {
    return { allowed: false, reason: "unauthenticated" };
  }
  if (permission) {
    const perm = ensurePermission(page.actor, permission);
    if (!perm.ok) {
      return { allowed: false, reason: perm.error.code };
    }
  }
  const result = await fn({ ...page, actor: page.actor });
  if (!result.ok) {
    return { allowed: false, reason: result.error.code };
  }
  const { ok: _ok, ...payload } = result;
  return { allowed: true, ...(payload as T) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test -- test/shared/guarded.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Convert the exemplar route**

`src/routes/$citySlug/admin/courses/index.tsx` — replace the handler body. Before:

```ts
const loadCourses = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listAllAdmin(page.store, page.actor);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      courses: result.courses.map((course) => ({ ... })),
    };
  });
```

After:

```ts
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";

const loadCourses = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, null, async (page) => {
      const result = await listAllAdmin(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        courses: result.courses.map((course) => ({
          detail: `${course.status} · ${course.lessonCount} lessons`,
          href: `/${page.tenant.slug}/admin/courses/${course.id}/edit`,
          id: course.id,
          title: course.title,
        })),
      });
    }),
  );
```

Remove the now-unused `loadCityPage` import from the route. The component code (`DeniedCard` on `!data.allowed`) does not change.

- [ ] **Step 6: Verify the whole gate**

Run: `cd apps/web && bun run test && bun run check`
Expected: all tests PASS, biome + tsc clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/http/guarded.ts apps/web/test/shared/guarded.test.ts apps/web/src/routes/\$citySlug/admin/courses/index.tsx
git commit -m "refactor(start): add guarded() route-guard interface with exemplar"
```

---

### Task 2: Sweep batch A — convert admin routes to `guarded()`

**Files:**

- Modify (every file that matches the ritual, batch A):
  `src/routes/admin/index.tsx`, `src/routes/$citySlug/admin/settings.tsx`, `src/routes/$citySlug/admin/import.tsx`, `src/routes/$citySlug/admin/index.tsx`, `src/routes/$citySlug/admin/speakers.tsx`, `src/routes/$citySlug/admin/roles.tsx`, `src/routes/$citySlug/admin/analytics.tsx`, `src/routes/$citySlug/admin/invite.tsx`, `src/routes/$citySlug/admin/cities.tsx`, `src/routes/$citySlug/admin/badges.tsx`, `src/routes/$citySlug/admin/users.tsx`, `src/routes/$citySlug/admin/route.tsx`, `src/routes/$citySlug/admin/tiers.tsx`, `src/routes/$citySlug/admin/posts.tsx`, `src/routes/$citySlug/admin/tools/attendance-planner.tsx`, `src/routes/$citySlug/admin/tools/attendee-analytics.tsx`, `src/routes/$citySlug/admin/tools/index.tsx`, `src/routes/$citySlug/admin/tools/qr-generator.tsx`, `src/routes/$citySlug/admin/tools/slide-generator.tsx`, `src/routes/$citySlug/admin/industries/new.tsx`, `src/routes/$citySlug/admin/industries/index.tsx`, `src/routes/$citySlug/admin/industries/$slug.tsx`

**Interfaces:**

- Consumes: `guarded(citySlug, permission, fn)` and `GuardedPage` from `@/shared/http/guarded` (Task 1); `ok` from `@/shared/http/errors`.
- Produces: nothing new — behaviour-preserving conversion.

**The transformation, applied per server fn in each file:**

Every handler that currently does the ritual

```ts
const page = await loadCityPage(data.citySlug);
if (!(page.ok && page.actor)) {
  return { allowed: false as const, reason: "unauthenticated" };
}
// optionally: const perm = ensurePermission(page.actor, "X"); if (!perm.ok) return { allowed: false as const, reason: perm.error.code };
const result = await someService(page.store, page.actor, ...);
if (!result.ok) {
  return { allowed: false as const, reason: result.error.code };
}
return { allowed: true as const, ...payload };
```

becomes

```ts
return guarded(data.citySlug, "X" /* or null when the route had no explicit ensurePermission */, async (page) => {
  const result = await someService(page.store, page.actor, ...);
  if (!result.ok) {
    return result;
  }
  return ok({ ...payload });
});
```

Rules for the sweep:

1. When the old handler called `ensurePermission(page.actor, "X")` inline before the service call, pass `"X"` as the permission argument and delete the inline check. When it did not, pass `null` — the service's own `ensurePermission` still runs. Never invent a permission that wasn't checked before.
2. When the old handler discarded the specific load failure and always returned `reason: "unauthenticated"`, the new code will return the real `page.error.code` (e.g. `not_found`) for load failures. This is an accepted, deliberate improvement — do not add code to preserve the old collapsed reason.
3. Handlers using `requireCityActor` instead of `loadCityPage` with the same denied shape convert identically (guarded already enforces the actor).
4. Handlers that do NOT return the `{ allowed }` shape (e.g. return raw data, a Response, or an `{ ok, error }` shape) are **out of scope — leave them untouched**.
5. Multi-step handlers (several service calls) keep their intermediate logic inside the `fn` body; each `if (!r.ok) return r;` early-return still works because `guarded` maps any Err to denied.
6. Remove imports (`loadCityPage`, `ensurePermission`, `requireCityActor`) that become unused; add `guarded`/`ok` imports.
7. If a specific handler resists the pattern (shape mismatch, actor-optional logic), skip it and list it in the report — do not force it.

- [ ] **Step 1: Convert every listed file** (apply the transformation to each server fn matching the ritual)
- [ ] **Step 2: Verify**

Run: `cd apps/web && bun run test && bun run check`
Expected: all PASS, tsc clean — the payload types flow through `Guarded<T>` unchanged.

- [ ] **Step 3: Grep-verify the batch**

Run: `cd apps/web && grep -rn "allowed: false as const" src/routes/admin src/routes/\$citySlug/admin/*.tsx src/routes/\$citySlug/admin/tools src/routes/\$citySlug/admin/industries | wc -l`
Expected: 0 (excluding any handlers deliberately skipped under rule 7 — name them in the report).

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/routes
git commit -m "refactor(start): route batch A onto guarded()"
```

---

### Task 3: Sweep batch B — remaining admin routes to `guarded()`

**Files:**

- Modify: `src/routes/$citySlug/admin/courses/$id/edit.tsx`, `src/routes/$citySlug/admin/courses/new.tsx`, `src/routes/$citySlug/admin/social/settings.tsx`, `src/routes/$citySlug/admin/social/index.tsx`, `src/routes/$citySlug/admin/pages/index.tsx`, `src/routes/$citySlug/admin/pages/new.tsx`, `src/routes/$citySlug/admin/pages/$id.tsx`, `src/routes/$citySlug/admin/pages/home.tsx`, `src/routes/$citySlug/admin/events/index.tsx`, `src/routes/$citySlug/admin/events/new.tsx`, `src/routes/$citySlug/admin/email/new.tsx`, `src/routes/$citySlug/admin/email/settings.tsx`, `src/routes/$citySlug/admin/email/$id.tsx`, `src/routes/$citySlug/admin/email/contacts.tsx`, `src/routes/$citySlug/admin/email/templates.tsx`, `src/routes/$citySlug/admin/email/analytics.tsx`, `src/routes/$citySlug/admin/email/index.tsx`, `src/routes/$citySlug/admin/email/automations.tsx`, plus any other file `grep -rln "allowed: false as const" src/routes` still reports.

**Interfaces:**

- Consumes: `guarded` from `@/shared/http/guarded`, `ok` from `@/shared/http/errors`.
- Produces: nothing new.

- [ ] **Step 1: Convert every listed file** using exactly the transformation and the 7 rules from Task 2 (they are restated here by reference deliberately — Task 2's rule list is the specification; read Task 2's transformation block in your brief).

The transformation: replace each `loadCityPage` + actor-check + optional inline `ensurePermission` + `Result`-to-`{allowed}` reshaping ritual with a single `guarded(data.citySlug, perm, async (page) => { ...; return ok({ ... }); })` call, preserving the exact success payload fields. Same 7 rules: inline permission moves into the argument (else `null`); real error codes may now surface; `requireCityActor` converts the same way; non-`allowed`-shaped handlers stay untouched; multi-call handlers keep logic inside `fn`; prune dead imports; skip-and-report resisters.

- [ ] **Step 2: Verify**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS.

- [ ] **Step 3: Grep-verify the whole codebase**

Run: `cd apps/web && grep -rn "allowed: false as const" src | wc -l`
Expected: 0 (minus reported skips).

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/routes
git commit -m "refactor(start): route batch B onto guarded()"
```

---

### Task 4: Pull cron + publish workflow behind the social seam

**Files:**

- Modify: `src/worker-scheduled.ts`
- Modify: `src/workflows/publish-post.ts`
- Modify: `src/modules/social/services/socialService.ts`
- Modify: `src/modules/social/types.ts` (add the workflow-starter type)
- Create: `src/modules/social/services/publishStarter.ts`
- Test: `test/social/publishSeam.test.ts` (create)

**Interfaces:**

- Consumes: `socialRepo.listDueScheduled(store, now): Promise<SocialPostSummary[]>`, `socialRepo.claimForPublish(store, postId)`, `socialRepo.updatePostById(store, postId, patch)`, `socialRepo.getPostById(store, postId)` — all existing in `src/modules/social/repositories/socialRepository.ts`; `TenantStore`; `Result`/`ok`/`err`.
- Produces (later steps and the cron rely on these exact names):
  - `socialService.claimPostForPublish(store: TenantStore, postId: string): Promise<Result<{ attempt: number; claimed: boolean }>>`
  - `socialService.markPublishFailed(store: TenantStore, postId: string, message: string): Promise<Result<Record<string, never>>>`
  - `socialService.listDuePublishable(store: TenantStore, now: Date): Promise<Result<{ posts: { id: string }[] }>>`
  - `publishStarterFromEnv(env: Record<string, unknown>): PublishStarter | undefined` where `PublishStarter = { start(params: { d1Binding: string; orgId: string; postId: string }): Promise<void> }`

- [ ] **Step 1: Write the failing tests**

```ts
// test/social/publishSeam.test.ts
import { describe, expect, it } from "vitest";
import {
  claimPostForPublish,
  listDuePublishable,
  markPublishFailed,
} from "@/modules/social/services/socialService";
import { publishStarterFromEnv } from "@/modules/social/services/publishStarter";
import { openMemoryTenant } from "../helpers/tenant";

// Insert a row directly through the store; adapt fields to the actual
// socialPosts schema (check src/modules/social/schema.tenant.ts — required
// columns must be provided; use the schema's column names verbatim).
async function insertScheduledPost(store: ReturnType<typeof openMemoryTenant>, id: string) {
  const { socialPosts } = store.tables;
  await store.db.insert(socialPosts).values({
    id,
    orgId: store.orgId,
    // fill remaining NOT NULL columns per schema.tenant.ts (content, platform,
    // status: "scheduled", scheduledAt: new Date(Date.now() - 60_000),
    // externalId: null, createdAt/updatedAt, etc.)
  } as never);
}

describe("publish seam", () => {
  it("listDuePublishable returns due scheduled posts without externalId", async () => {
    const store = openMemoryTenant();
    await insertScheduledPost(store, "post_1");
    const result = await listDuePublishable(store, new Date());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.posts.map((p) => p.id)).toContain("post_1");
    }
  });

  it("claimPostForPublish claims a scheduled post", async () => {
    const store = openMemoryTenant();
    await insertScheduledPost(store, "post_1");
    const result = await claimPostForPublish(store, "post_1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claimed).toBe(true);
    }
  });

  it("markPublishFailed writes status=failed with the message", async () => {
    const store = openMemoryTenant();
    await insertScheduledPost(store, "post_1");
    const result = await markPublishFailed(store, "post_1", "no connector");
    expect(result.ok).toBe(true);
    const { socialPosts } = store.tables;
    const rows = await store.db.select().from(socialPosts);
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.errorMessage).toBe("no connector");
  });

  it("publishStarterFromEnv returns undefined without a binding and a starter with one", async () => {
    expect(publishStarterFromEnv({})).toBeUndefined();
    const calls: unknown[] = [];
    const starter = publishStarterFromEnv({
      PUBLISH_POST: { create: (opts: unknown) => (calls.push(opts), Promise.resolve()) },
    });
    expect(starter).toBeDefined();
    await starter?.start({ d1Binding: "TENANT_TEST", orgId: "org_test", postId: "p1" });
    expect(calls).toEqual([
      { params: { d1Binding: "TENANT_TEST", orgId: "org_test", postId: "p1" } },
    ]);
  });
});
```

The `insertScheduledPost` helper must be completed against the real `schema.tenant.ts` columns — read that file and fill every NOT NULL column. If a `socialAccounts` row is required (the repo's `toPost` joins accounts), insert a minimal account row too.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun run test -- test/social/publishSeam.test.ts`
Expected: FAIL — the three service functions and `publishStarterFromEnv` don't exist.

- [ ] **Step 3: Add the service functions**

In `src/modules/social/services/socialService.ts` (append; reuse the file's existing imports of `socialRepo`, `ok`, `err`, `Result`, `TenantStore`):

```ts
/** Cron-facing: due scheduled posts with no externalId (native-scheduled excluded). */
export async function listDuePublishable(
  store: TenantStore,
  now: Date,
): Promise<Result<{ posts: { id: string }[] }>> {
  const posts = await socialRepo.listDueScheduled(store, now);
  return ok({ posts: posts.map((p) => ({ id: p.id })) });
}

/** Workflow-facing: atomically claim a post for publishing. */
export async function claimPostForPublish(
  store: TenantStore,
  postId: string,
): Promise<Result<{ attempt: number; claimed: boolean }>> {
  const result = await socialRepo.claimForPublish(store, postId);
  if (!result.ok) {
    return result;
  }
  return ok({ attempt: result.attempt, claimed: result.claimed });
}

/** Workflow-facing: terminal failure transition, one place. */
export async function markPublishFailed(
  store: TenantStore,
  postId: string,
  message: string,
): Promise<Result<Record<string, never>>> {
  const updated = await socialRepo.updatePostById(store, postId, {
    errorMessage: message,
    status: "failed",
  });
  if (!updated.ok) {
    return updated;
  }
  return ok({});
}
```

(Adjust to `claimForPublish`'s actual return shape if it differs — read the repository first; the `Interfaces` block above records what the survey saw.)

Create `src/modules/social/services/publishStarter.ts`:

```ts
/** Typed seam over the PUBLISH_POST workflow binding. */
export interface PublishStarter {
  start(params: { d1Binding: string; orgId: string; postId: string }): Promise<void>;
}

export function publishStarterFromEnv(env: Record<string, unknown>): PublishStarter | undefined {
  const binding = env.PUBLISH_POST as
    { create: (opts: { params: unknown }) => Promise<unknown> } | undefined;
  if (!binding?.create) {
    return undefined;
  }
  return {
    async start(params) {
      await binding.create({ params });
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && bun run test -- test/social/publishSeam.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire `worker-scheduled.ts`**

In `drainCity`, delete the raw drizzle block (the `store.db.select().from(socialPosts)...` query, its `drizzle-orm` / `schema.tenant` imports, and the hand-rolled `env.PUBLISH_POST` cast) and replace with:

```ts
const { listDuePublishable } = await import("@/modules/social/services/socialService");
const { publishStarterFromEnv } = await import("@/modules/social/services/publishStarter");

const due = await listDuePublishable(store, now);
const starter = publishStarterFromEnv(env);
if (due.ok && starter) {
  for (const post of due.posts) {
    // biome-ignore lint/performance/noAwaitInLoops: workflow create is per-post
    await starter.start({ d1Binding: city.d1Binding, orgId: city.orgId, postId: post.id });
  }
}
```

Keep the dynamic `await import()` style — it exists to keep `cloudflare:workers`-adjacent code out of the client graph. The email half of `drainCity` stays exactly as is.

- [ ] **Step 6: Rewire `src/workflows/publish-post.ts`**

Replace direct `socialRepo` calls with the service seam:

- `socialRepo.claimForPublish(store, postId)` → `claimPostForPublish(store, postId)` (import from `@/modules/social/services/socialService`).
- The no-connector branch's `socialRepo.updatePostById(store, postId, { errorMessage, status: "failed" })` → `markPublishFailed(store, postId, "No social connector is configured on this Worker")`.
- `socialRepo.getPostById(store, postId)` → keep, **but** move it behind the service too if `socialService` already exposes a `getPost`-style function — check first; if none exists, add `export async function getPostForPublish(store: TenantStore, postId: string)` that forwards to `socialRepo.getPostById` and use it. Remove the `socialRepo` import from the workflow entirely.

- [ ] **Step 7: Verify + commit**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS.

```bash
git add -A apps/web/src
git add apps/web/test/social/publishSeam.test.ts
git commit -m "refactor(start): cron and publish workflow go through the social service seam"
```

---

### Task 5: Evict the ambient env from tenants + identity services

**Files:**

- Modify: `src/modules/tenants/services/publicListService.ts`
- Modify: `src/modules/identity/services/sessionService.ts`
- Modify: `src/modules/system/services/mcpHttp.ts`
- Modify: `src/modules/community/services/postsService.ts` (imports `resolveCityService` — update call sites)
- Modify: `src/routes/$citySlug/events/index.tsx` (call site — minimal signature fix only; Task 8 rewrites this route properly)
- Test: `test/tenants/publicListService.test.ts` (create)

**Interfaces:**

- Consumes: `RegistryDb` type from `@/shared/db/client`; `getRegistryDb()` from `@/shared/db/env` (now called only by composition points); `openMemoryRegistry()` from `test/helpers/registry.ts`.
- Produces (exact new signatures — every caller must pass the db):
  - `resolveCityContext(db: RegistryDb, slug: string): Promise<Result<{ tenant: TenantContext }>>`
  - `listPublicTenants(db: RegistryDb): Promise<Result<{ tenants: { slug: string; name: string }[] }>>`
  - `provisionCity(db: RegistryDb, input: ProvisionCityInput): Promise<Result<{ tenant: TenantContext }>>`
  - `syncSessionUser(db: RegistryDb): Promise<Result<{ auth: AuthContext }>>`
  - `buildCityRouteContext(citySlug)` keeps its signature — it is the composition point and calls `getRegistryDb()` **once**, passing the db down.

- [ ] **Step 1: Write the failing test**

```ts
// test/tenants/publicListService.test.ts
import { describe, expect, it } from "vitest";
import {
  listPublicTenants,
  provisionCity,
  resolveCityContext,
} from "@/modules/tenants/services/publicListService";
import { openMemoryRegistry } from "../helpers/registry";

describe("publicListService with an in-memory registry", () => {
  it("provisions a city then resolves it by slug", async () => {
    const registry = openMemoryRegistry();
    // openMemoryRegistry returns a store or a db — pass its drizzle handle;
    // check test/helpers/registry.ts for the exact shape (`.db` or the value itself).
    const db = ("db" in registry ? registry.db : registry) as never;

    const provisioned = await provisionCity(db, { name: "Sydney", slug: "sydney" });
    expect(provisioned.ok).toBe(true);

    const resolved = await resolveCityContext(db, "sydney");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.tenant.slug).toBe("sydney");
      expect(resolved.tenant.r2Prefix).toBe("tenants/sydney");
    }
  });

  it("404s an unknown slug", async () => {
    const registry = openMemoryRegistry();
    const db = ("db" in registry ? registry.db : registry) as never;
    const resolved = await resolveCityContext(db, "nowhere");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("not_found");
    }
  });

  it("lists only listed tenants", async () => {
    const registry = openMemoryRegistry();
    const db = ("db" in registry ? registry.db : registry) as never;
    await provisionCity(db, { name: "Sydney", slug: "sydney", listed: true });
    await provisionCity(db, { name: "Hidden", slug: "hidden", listed: false });
    const result = await listPublicTenants(db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenants.map((t) => t.slug)).toEqual(["sydney"]);
    }
  });
});
```

Resolve the `openMemoryRegistry` shape against `test/helpers/registry.ts` before running — the `"db" in registry` dance above is a placeholder for whichever access is real; write the real one.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test -- test/tenants/publicListService.test.ts`
Expected: FAIL — current functions take no `db` parameter (type error / wrong arity).

- [ ] **Step 3: Change `publicListService.ts`**

- Delete the `import { getRegistryDb } from "@/shared/db/env";` line.
- Add `import type { RegistryDb } from "@/shared/db/client";` (verify the exported type name in `src/shared/db/client.ts` — if it is `ReturnType<typeof createRegistryDb>` unexported, export a `RegistryDb` type alias there).
- Each of the three exported functions gains `db: RegistryDb` as the **first** parameter and drops its internal `const db = getRegistryDb();` line. Bodies otherwise unchanged (including the try/catch in `listPublicTenants` and `resolveCityContext`).

- [ ] **Step 4: Update every caller**

Find them: `cd apps/web && grep -rn "resolveCityContext\|listPublicTenants\|provisionCity" src scripts --include="*.ts" --include="*.tsx" --include="*.mjs"`

Known callers and their fixes:

- `src/modules/identity/services/sessionService.ts` → `buildCityRouteContext`: build `const registryDb = getRegistryDb();` once at the top, pass to `resolveCityContext(registryDb, citySlug)`, reuse the same `registryDb` for `usersRepo.findMembership(...)` and for `ctx.registryDb` (deleting the two extra `getRegistryDb()` calls). Also change `syncSessionUser` to accept `db: RegistryDb` and use it for `usersRepo.upsertFromClerk`; `buildCityRouteContext` passes `registryDb` in. Import `resolveCityContext` from `@/modules/tenants/services/publicListService` directly (drop the `resolveCityService` shim import — the shim dies in Task 8).
- `src/modules/system/services/mcpHttp.ts` → wherever it calls the changed functions, obtain `const db = getRegistryDb();` at the handler top (mcpHttp is an HTTP composition point — env access is allowed there per Global Constraints? It is not in the allowlist, so instead import `getRegistryDb` from `@/shared/db/env` — this file already uses `workerEnv()`; keep its env usage as-is, only add the `db` argument to the changed calls).
- `src/modules/community/services/postsService.ts` → same: it already calls `openTenantStore` from env; give it the db argument from `getRegistryDb()` at its composition entry, or accept a db param if its own callers are routes (choose the smallest change that compiles and keeps tests green; note the choice in the report).
- `src/routes/$citySlug/events/index.tsx` → change `resolveCityContext(data.citySlug)` to `resolveCityContext(getRegistryDb(), data.citySlug)` with `import { getRegistryDb } from "@/shared/db/env";` — minimal fix; Task 8 replaces this route's plumbing wholesale.
- Any `scripts/*.ts`/`.mjs` callers (e.g. seed/provision scripts): pass the db they already construct.

Note on Global Constraints: `sessionService.ts`, `mcpHttp.ts`, `postsService.ts`, and route files import env helpers via `@/shared/db/env` (not `cloudflare:workers` directly) — that stays allowed; the constraint bans direct `cloudflare:workers` imports only.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && bun run test -- test/tenants/publicListService.test.ts`
Expected: PASS.

- [ ] **Step 6: Full gate + commit**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS.

```bash
git add -A apps/web/src apps/web/test apps/web/scripts
git commit -m "refactor(start): registry services take RegistryDb instead of ambient env"
```

---

### Task 6: Memoise the session/city hot path

**Files:**

- Create: `src/shared/ttlMemo.ts`
- Modify: `src/modules/identity/services/sessionService.ts`
- Test: `test/shared/ttlMemo.test.ts` (create)

**Interfaces:**

- Consumes: Task 5's shapes (`syncSessionUser(db)`, `buildCityRouteContext` composition point).
- Produces: `ttlMemo<T>(ttlMs: number): { get(key: string): T | undefined; set(key: string, value: T): void }`.

**Why:** every server fn call re-runs `syncSessionUser` → one Clerk `users.getUser()` network round-trip + one registry UPSERT. A page interaction with 4 server fns costs 4 Clerk calls. Server fns arrive as separate HTTP requests, so a request-scoped memo would not help — the memo must be isolate-scoped with a short TTL. **Decision (ruled by the controller): 60-second TTL keyed by Clerk user id. Consequence: a ban or profile change takes up to 60s to propagate to an already-hot isolate. Membership/role lookup stays per-request (fresh).** City resolution (`resolveCityContext`) gets the same treatment keyed by slug: tenant config changes take up to 60s.

- [ ] **Step 1: Write the failing test**

```ts
// test/shared/ttlMemo.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ttlMemo } from "@/shared/ttlMemo";

describe("ttlMemo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a cached value inside the TTL", () => {
    const memo = ttlMemo<number>(60_000);
    memo.set("k", 1);
    vi.advanceTimersByTime(59_000);
    expect(memo.get("k")).toBe(1);
  });

  it("expires after the TTL", () => {
    const memo = ttlMemo<number>(60_000);
    memo.set("k", 1);
    vi.advanceTimersByTime(61_000);
    expect(memo.get("k")).toBeUndefined();
  });

  it("misses unknown keys", () => {
    const memo = ttlMemo<number>(60_000);
    expect(memo.get("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test -- test/shared/ttlMemo.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/shared/ttlMemo.ts
/**
 * Isolate-scoped TTL memo. Values persist across requests within one Worker
 * isolate and expire after ttlMs. Deliberately tiny: no LRU, no size cap —
 * keys are low-cardinality (users, city slugs).
 */
export function ttlMemo<T>(ttlMs: number): {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
} {
  const entries = new Map<string, { at: number; value: T }>();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) {
        return undefined;
      }
      if (Date.now() - hit.at > ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      entries.set(key, { at: Date.now(), value });
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && bun run test -- test/shared/ttlMemo.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into `sessionService.ts`**

At module scope:

```ts
import { ttlMemo } from "@/shared/ttlMemo";
import type { TenantContext } from "@/shared/http/routeContext";

/** 60s isolate cache: Clerk fetch + registry upsert per user, city row per slug.
 *  Accepted staleness: bans/profile edits and tenant config take ≤60s to land
 *  on a hot isolate. Membership/role stays fresh per request. */
const sessionMemo = ttlMemo<AuthContext>(60_000);
const cityMemo = ttlMemo<TenantContext>(60_000);
```

In `syncSessionUser(db)`: after the Clerk session check succeeds (`session.userId` known), consult `sessionMemo.get(session.userId)` — on hit, `return ok({ auth: cached })` skipping `readClerkUser` and the upsert. On miss, run the existing path and `sessionMemo.set(session.userId, auth)` just before returning ok. The `banned` and `missing_email` failure paths must NOT be cached.

In `buildCityRouteContext`: consult `cityMemo.get(citySlug)` before `resolveCityContext`; on miss and a successful resolve, `cityMemo.set(citySlug, city.tenant)`. Failed resolves are not cached.

- [ ] **Step 6: Full gate + commit**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS.

```bash
git add apps/web/src/shared/ttlMemo.ts apps/web/test/shared/ttlMemo.test.ts apps/web/src/modules/identity/services/sessionService.ts
git commit -m "perf(start): 60s isolate memo for Clerk session sync and city resolution"
```

---

### Task 7: A real upload interface — `storeUpload` behind the seam

**Files:**

- Modify: `src/modules/system/services/uploadService.ts`
- Modify: `src/routes/api/upload.ts`
- Modify: `src/routes/api/upload/mcp.ts`
- Test: `test/system/uploadService.test.ts` (create)

**Interfaces:**

- Consumes: `putBytes(key, bytes, contentType)`, `publicUrl(key)`, `tenantObjectKey(r2Prefix, ...parts)`, `isStorageConfigured()` from `@/shared/storage/r2`; `Result`/`ok`/`err`.
- Produces:
  - `sanitizeFilename(name: string): string`
  - `buildUploadKey(opts: { folder: string; filename: string; r2Prefix?: string | null }): Result<{ key: string }>`
  - `storeUpload(form: FormData, opts?: { r2Prefix?: string | null }): Promise<Result<{ key: string; url: string }>>`

**Security notes this task fixes (deliberate behaviour changes, already ruled):**

1. `POST /api/upload` currently requires **no authentication** — anyone can write to the bucket. It now requires a signed-in Clerk user (via `syncSessionUser`). MCP upload keeps its bearer check.
2. `file.name` currently goes into the R2 key raw — sanitize it.
3. `folder` is a raw user string — restrict to a safe charset.

- [ ] **Step 1: Write the failing tests**

```ts
// test/system/uploadService.test.ts
import { describe, expect, it } from "vitest";
import { buildUploadKey, sanitizeFilename } from "@/modules/system/services/uploadService";

describe("sanitizeFilename", () => {
  it("strips path separators and odd characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFilename("photo (1).PNG")).toBe("photo-1.PNG");
  });
  it("falls back for empty results", () => {
    expect(sanitizeFilename("///")).toBe("file");
  });
});

describe("buildUploadKey", () => {
  it("prefixes with the tenant r2Prefix when given", () => {
    const result = buildUploadKey({
      filename: "a.png",
      folder: "uploads",
      r2Prefix: "tenants/sydney",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toMatch(/^tenants\/sydney\/uploads\/[0-9a-f-]{36}-a\.png$/);
    }
  });
  it("builds an unprefixed key without a tenant", () => {
    const result = buildUploadKey({ filename: "a.png", folder: "uploads", r2Prefix: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toMatch(/^uploads\/[0-9a-f-]{36}-a\.png$/);
    }
  });
  it("rejects a folder with path tricks", () => {
    const result = buildUploadKey({ filename: "a.png", folder: "../secrets", r2Prefix: null });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test -- test/system/uploadService.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement in `uploadService.ts`** (keep the existing MCP-curl helper the file already has)

```ts
import { err, ok, type Result } from "@/shared/http/errors";
import { publicUrl, putBytes, StorageError, tenantObjectKey } from "@/shared/storage/r2";

const FOLDER_RE = /^[a-z0-9][a-z0-9/_-]{0,63}$/i;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[-.]+$/g, "")
    .replace(/-{2,}/g, "-");
  return cleaned || "file";
}

export function buildUploadKey(opts: {
  folder: string;
  filename: string;
  r2Prefix?: string | null;
}): Result<{ key: string }> {
  if (!FOLDER_RE.test(opts.folder) || opts.folder.includes("..")) {
    return err("invalid_folder", 400);
  }
  const name = `${crypto.randomUUID()}-${sanitizeFilename(opts.filename)}`;
  const key = opts.r2Prefix
    ? tenantObjectKey(opts.r2Prefix, opts.folder, name)
    : `${opts.folder}/${name}`;
  return ok({ key });
}

/** The one upload implementation. Routes are thin adapters over this. */
export async function storeUpload(
  form: FormData,
  opts: { r2Prefix?: string | null } = {},
): Promise<Result<{ key: string; url: string }>> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return err("file_required", 400);
  }
  const folder = String(form.get("folder") ?? "uploads");
  const built = buildUploadKey({ filename: file.name, folder, r2Prefix: opts.r2Prefix });
  if (!built.ok) {
    return built;
  }
  try {
    await putBytes(built.key, await file.arrayBuffer(), file.type || "application/octet-stream");
  } catch (e) {
    if (e instanceof StorageError) {
      return err("storage_unavailable", e.status);
    }
    throw e;
  }
  return ok({ key: built.key, url: publicUrl(built.key) });
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd apps/web && bun run test -- test/system/uploadService.test.ts`
Expected: PASS.

- [ ] **Step 5: Make both routes adapters**

`src/routes/api/upload.ts` POST handler becomes:

```ts
POST: async ({ request }) => {
  if (!isStorageConfigured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  const { getRegistryDb } = await import("@/shared/db/env");
  const { syncSessionUser } = await import("@/modules/identity/services/sessionService");
  const session = await syncSessionUser(getRegistryDb());
  if (!session.ok) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { storeUpload } = await import("@/modules/system/services/uploadService");
  const result = await storeUpload(await request.formData());
  if (!result.ok) {
    return Response.json({ error: result.error.code }, { status: result.error.status });
  }
  return Response.json({ key: result.key, url: result.url });
},
```

`src/routes/api/upload/mcp.ts` POST handler: keep the CORS wrapper, `isStorageConfigured` preflight, and `actorFromBearer` check exactly as they are, then replace the formData/key/putBytes block with the same `storeUpload(await request.formData())` call, `withCors`-wrapping the responses.

(Neither route passes `r2Prefix` yet — these endpoints are tenant-agnostic today and no caller sends a city; the prefix parameter is exercised by tests and ready for tenant-scoped callers. Do not invent a citySlug form field.)

- [ ] **Step 6: Check existing upload callers still work**

Run: `cd apps/web && grep -rn "api/upload" src e2e | grep -v routes/api/upload`
Any in-app caller of `/api/upload` runs as a signed-in admin (uploads happen from admin UI), so the new auth gate holds. If a caller is provably unauthenticated (public page), report it — do not silently weaken the gate.

- [ ] **Step 7: Full gate + commit**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS.

```bash
git add -A apps/web/src/routes/api apps/web/src/modules/system apps/web/test/system
git commit -m "refactor(start): single storeUpload seam with auth, sanitized keys"
```

---

### Task 8: Shim sweep — delete pass-throughs, fix the stray route

**Files:**

- Delete: `src/modules/tenants/services/resolveCityService.ts`
- Delete: `src/modules/social/services/socialPostsService.ts` (fold into `socialService.ts`)
- Modify: `src/modules/social/services/socialService.ts` (absorb `countScheduled`)
- Modify: every importer of the two deleted files (grep-driven; known: `src/modules/system/services/mcpHttp.ts`, `src/modules/community/services/postsService.ts`, `src/routes/$citySlug/events/index.tsx` for the tenants shim; find socialPostsService importers by grep)
- Modify: `src/routes/$citySlug/events/index.tsx` (use `loadCityPage` instead of hand-rolled resolve + open)

**Interfaces:**

- Consumes: `loadCityPage` from `@/shared/http/cityPage`; `publicListService` exports (post-Task 5 signatures); existing `socialRepo.countByStatus(store, status)`.
- Produces: `socialService.countScheduled(store, actor)` — same behaviour the deleted file had.

- [ ] **Step 1: Fold `countScheduled` into `socialService.ts`**

Append (adjusting imports to the file's existing ones):

```ts
export async function countScheduled(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ count: number }>> {
  const perm = ensurePermission(actor, "social.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ count: await socialRepo.countByStatus(store, "scheduled") });
}
```

Delete `src/modules/social/services/socialPostsService.ts`. Update importers: `cd apps/web && grep -rln "socialPostsService" src test` → point each at `@/modules/social/services/socialService`.

- [ ] **Step 2: Delete the tenants shim**

Delete `src/modules/tenants/services/resolveCityService.ts`. Update importers found by `grep -rln "resolveCityService" src test scripts` to import from `@/modules/tenants/services/publicListService` (same export names; Task 5 already moved `sessionService.ts` off the shim).

- [ ] **Step 3: Rewrite the stray public events route**

`src/routes/$citySlug/events/index.tsx` — replace the handler's hand-rolled `resolveCityContext` + `openTenantStore` plumbing with `loadCityPage` (public page: no actor requirement, keep the empty-events fallback on failure):

```ts
import { loadCityPage } from "@/shared/http/cityPage";

const getEvents = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const empty = {
      events: [] as { id: string; title: string; startTime: string | null; slug: string }[],
    };
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return empty;
    }
    const result = await listEvents(page.store);
    if (!result.ok) {
      return empty;
    }
    return {
      events: result.events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        slug: e.slug,
      })),
    };
  });
```

Remove the now-unused `resolveCityContext` / `openTenantStore` / `getRegistryDb` imports.

- [ ] **Step 4: Grep for leftovers**

Run: `cd apps/web && grep -rn "resolveCityService\|socialPostsService" src test scripts`
Expected: no matches.

- [ ] **Step 5: Full gate + commit**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS.

```bash
git add -A apps/web/src apps/web/test
git commit -m "refactor(start): delete pass-through shims, route stray events page through loadCityPage"
```

Note: `src/workflows/slide-export.ts` (stub) is deliberately **not** deleted — it is wired into `wrangler.jsonc` workflow bindings and `server.ts` exports; removing a deployed workflow class is a deploy-coordination change out of this plan's scope. Ledger it as deferred.

---

### Task 9: Repo hygiene — shared row helpers + per-repo table slices

**Files:**

- Create: `src/shared/db/rows.ts`
- Test: `test/shared/rows.test.ts` (create)
- Modify: every `src/modules/*/repositories/*.ts` that defines a local `first<T>` (≈19 files) or a local `iso(value)` (≈5 files) — find with grep; and add a table-slice type to each repository file (20 files).

**Interfaces:**

- Consumes: `TenantTables` from `@/shared/db/tenantSchema`; `TenantStore`.
- Produces:
  - `first<T>(rows: T[]): T | undefined`
  - `iso(value: Date | null | undefined): string | null`
  - Per-repo pattern: `type XxxTables = Pick<TenantTables, "tableA" | "tableB">;` + `const tables = (store: TenantStore): XxxTables => store.tables;`

- [ ] **Step 1: Write the failing test**

```ts
// test/shared/rows.test.ts
import { describe, expect, it } from "vitest";
import { first, iso } from "@/shared/db/rows";

describe("rows helpers", () => {
  it("first returns the head or undefined", () => {
    expect(first([1, 2])).toBe(1);
    expect(first([])).toBeUndefined();
  });
  it("iso formats a Date and passes null through", () => {
    expect(iso(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
    expect(iso(null)).toBeNull();
    expect(iso(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test -- test/shared/rows.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/shared/db/rows.ts`**

```ts
/** Row-shaping helpers shared by every repository. */
export function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
```

Before the sweep, confirm the local copies match these semantics: `cd apps/web && grep -rn -A 3 "function first" src/modules` and same for `function iso`. A local variant with different behaviour (e.g. `iso` returning `undefined`, or a `first` that throws) keeps its local copy and gets listed in the report — do not change its behaviour.

- [ ] **Step 4: Run to verify it passes, then sweep**

Run: `cd apps/web && bun run test -- test/shared/rows.test.ts` → PASS.

Sweep: in each repository file with a matching local `first`/`iso`, delete the local definition and add `import { first, iso } from "@/shared/db/rows";` (only the names used).

- [ ] **Step 5: Add table slices per repository**

In each `src/modules/<domain>/repositories/<name>.ts` that destructures `store.tables`, add near the top:

```ts
import type { TenantTables } from "@/shared/db/tenantSchema";

/** The only tables this repository may touch. */
type EventsTables = Pick<TenantTables, "events" | "eventRsvps" | "eventAgendaItems">;
const tables = (store: TenantStore): EventsTables => store.tables;
```

(Name the type after the repo; list exactly the keys that repo's destructures use — derive by reading the file's `store.tables` usages.) Then change each `const { events } = store.tables;` to `const { events } = tables(store);`. The function is a structural narrowing — touching a table outside the slice becomes a compile error inside this repo. Registry-plane repositories (`identity`) using a registry schema follow the same pattern against their schema type if one exists; if not, skip them and note it.

This step is mechanical but wide; keep each file's diff to exactly: the import, the slice type, the `tables` helper, and the destructure swaps. No other reformatting.

- [ ] **Step 6: Full gate + commit**

Run: `cd apps/web && bun run test && bun run check`
Expected: PASS — tsc is the proof the slices are correct.

```bash
git add -A apps/web/src/modules apps/web/src/shared/db/rows.ts apps/web/test/shared/rows.test.ts
git commit -m "refactor(start): shared row helpers and per-repository table slices"
```

---

## Task order and dependencies

1 → 2 → 3 (guard, then sweeps). 4 independent. 5 → 6 (env eviction before memo). 7 depends on 5 (upload auth calls `syncSessionUser(db)`). 8 depends on 5 (shim callers changed there). 9 independent. Recommended execution order: 1, 2, 3, 4, 5, 6, 7, 8, 9.
