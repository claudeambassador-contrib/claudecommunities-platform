# Home Page CMS — Mini-PRD

Status: Proposed (v1, **adversarial-review integrated**) · Scope: one tenant-editable home page · Audience: implementation team

> **Review note (v1.1):** This revision integrates an adversarial review that
> verified every claim against the code. Corrections are inline below and flagged
> with **[review]**. Net changes: seed-before-deploy rollout (the webinar bar
> regresses if you deploy first); seed hardcodes the webinar content (it isn't in
> `REGION_CONFIGS`); `INSERT OR IGNORE` idiom; the `Content` nav group already
> exists (only a new `PERMISSION_GROUPS` group is added); per-card gradients,
> hero `\n`, `nationality` (not `countryName`), the Haiku image, and the
> `#events` anchor are called out so "reproduce today's page" actually holds;
> hero overrides flow to `<meta>` only, never the JSON-LD `<script>`. `richText`
> is **kept** (the user requirement is "add their own content") but plain-text only.

## Problem / Goal

The tenant home page (`src/app/t/[tenant]/page.tsx`) hardcodes nearly all copy,
the section list, and the section ordering. Today a community admin cannot change
the hero headline, the benefits cards, the audience-split copy, the CTA text,
whether the webinar bar shows, or the order of sections — only a handful of
values flow from `getTenantConfig()` (`mapImage`, `galleryImages`, plus the
SEO-ish strings). Onboarding a new tenant means a code edit and a deploy.

**Goal:** give each tenant a small, structured CMS for **one** page (`home`) so
admins can reorder, enable/disable, and edit the structured fields of a finite
set of blocks — with zero risk of a blank page and no SEO regression.

This is a **mini** CMS. The block library is closed and small; there is no
drafting, versioning, or arbitrary page authoring in v1.

## Non-goals (v1)

- No draft/publish or version history (edits are live on save).
- No multi-page management UI (the table supports it via a `key` column, but v1
  ships only `key = "home"`).
- No drag-and-drop polish — a simple up/down reorder is sufficient.
- No per-section custom CSS, A/B testing, scheduling, or content i18n.
- No new block types beyond the library below; no raw-HTML authoring.
- The Events section stays **fully dynamic** — its data is never CMS-ified.

## Users & permissions

- **Who:** community admins/editors for a tenant.
- **Permission:** add **`pages.view`** and **`pages.edit`** to the `PERMISSIONS`
  registry and a "Content" group in `PERMISSION_GROUPS`
  (`src/lib/permissions.ts`).
  - *Why `pages.*` not `content.*`:* the committed data model keys on a `key`
    column whose named future is "manage other pages per tenant". `pages.edit`
    aligns the permission name with the table's growth direction; a future
    blog/landing-page editor reuses the same permission instead of inventing a
    second content vocabulary.
- **Server gate:** `hasPermission(actor, "pages.edit")` in the save server
  action, after the `actor.isBanned` check (mirror
  `src/app/t/[tenant]/admin/settings/actions.ts`).
- **Client gate:** `<Can permission="pages.edit">` around the editor's
  action-bearing elements (`@/components/admin/Can`).
- **View gate:** the admin page redirects when `pages.view` is missing.
  **[review] Use the tenant-aware redirect, not a bare path:**
  `redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"))`
  (mirror `settings/page.tsx:20-23`). A bare `/admin` mis-routes under
  `/t/[tenant]/admin`.

## Data model

A **dedicated tenant-scoped table** (decided — not the config blob). Editorial
content has a different change cadence and concern than infra/branding config,
and the `key` column buys the "other pages" future for free.

### Prisma model (`prisma/schema.prisma`)

```prisma
model Page {
  id        String   @id @default(cuid())
  tenantId  String
  key       String   // v1: always "home"
  title     String?  // optional admin-facing label; not the SEO <title>
  sections  String   // JSON string: ordered array of typed blocks (see below)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, key])
}
```

- `sections` is a JSON **string** (D1/SQLite has no native JSON column; match the
  `TenantSetting.config` precedent). Parse/validate on read and on write.
- **MUST** register `"Page"` in `TENANT_SCOPED_MODELS`
  (`src/lib/tenant-models.ts`) — the chokepoint fails closed and CI fails if it
  is in neither set. Reads/writes go through `getPrisma()` (scoped), which
  auto-injects `tenantId`.

### Block-type union (TypeScript)

Define in a new `src/lib/cms/blocks.ts` (or co-located `types.ts`). Every block
carries `id` (cuid/uuid for React keys + reorder identity), `type`, and
`enabled`. Field sets are kept **typed and small**.

```ts
/** Discriminant for every block in the home sections array. */
export type BlockType =
  | "hero"
  | "webinar"
  | "benefits"
  | "audienceSplit"
  | "events"   // marker only — renders the dynamic <EventsSection/>
  | "discord"
  | "gallery"  // marker + headings; images still come from config.galleryImages
  | "cta"
  | "richText";

interface BlockBase {
  id: string;
  enabled: boolean;
}

/**
 * Hero. ALL copy fields are OPTIONAL OVERRIDES. When a field is null/empty the
 * renderer computes today's config-derived string (e.g. badge =
 * `${countryName}'s Claude Code Community`). This is what makes a brand-new
 * tenant (empty countryName) and "byte-for-byte AU" both work from one default.
 */
export interface HeroBlock extends BlockBase {
  type: "hero";
  badge?: string | null;          // default: `${countryName}'s Claude Code Community`
  heading?: string | null;        // default: `Claude Code Meetups\nAcross ${countryName}`
  body?: string | null;           // default: the config-interpolated paragraph
  primaryCtaLabel?: string | null;   // default: "View Upcoming Events" → #events
  // Secondary CTA + the signed-in welcome banner stay code-driven (auth-dependent).
  // mapImage stays sourced from config (already tenant-editable via settings).
}
// [review] NEWLINE RENDERING: today's h1 uses a literal <br/> (page.tsx:183). A
// raw `\n` in a heading string collapses to a space in HTML. The hero renderer
// MUST split heading on "\n" and join with <br/> (or `whitespace-pre-line`), or
// the seeded "Claude Code Meetups / Across <country>" renders on one line.

/** Webinar promo bar. Owns its own structured fields (hardcoded in page.tsx today). */
export interface WebinarBlock extends BlockBase {
  type: "webinar";
  href: string;          // e.g. "/webinars/claude-code-webinar-australia"
  title: string;
  description: string;
  thumbnailUrl: string;  // YouTube poster or uploaded image
}

export interface BenefitCard {
  icon: string;          // name from a fixed lucide allowlist (see Security)
  title: string;
  desc: string;
}
export interface BenefitsBlock extends BlockBase {
  type: "benefits";
  heading?: string | null;   // default: "Why Join Claude Code Meetups?"
  cards: BenefitCard[];      // default: today's 4 cards
}

export interface AudienceCard {
  href: string;          // internal path, validated (see Security)
  icon: string;          // lucide allowlist
  title: string;
  desc: string;
  ctaLabel?: string | null;  // default: "Learn More →"
}
// [review] PER-CARD ACCENT: today the two cards have DIFFERENT gradient bars +
// icon colors (Professionals: from-[#60A5FA] to-[#A78BFA], text-[#60A5FA];
// Vibe Coders: from-[#D4836A] to-[#4ADE80], text-[#D4836A] — page.tsx:327-348).
// These are NOT tenant-editable in v1. The renderer applies a fixed two-entry
// palette BY CARD INDEX (card 0 = blue/purple, card 1 = coral/green) so the
// default two cards look identical to today. Keep `cards.length === 2` for the
// default; extra cards reuse index-mod-palette. (Avoids polluting the editable
// type with color while preserving the byte-for-byte look.)
export interface AudienceSplitBlock extends BlockBase {
  type: "audienceSplit";
  heading?: string | null;   // default: "Find Your Community"
  subheading?: string | null;
  cards: AudienceCard[];     // default: Professionals + Vibe Coders
}

/** Marker: still renders the dynamic <EventsSection/>. No CMS data. */
export interface EventsBlock extends BlockBase { type: "events"; }

export interface DiscordBlock extends BlockBase {
  type: "discord";
  // href defaults to discordCommunityInvite() from config; logoSrc fixed.
}

/** Marker + headings; images keep coming from config.galleryImages. */
export interface GalleryBlock extends BlockBase {
  type: "gallery";
  heading?: string | null;     // default: "From Our Claude Code Meetups"
  subheading?: string | null;  // default: `Real moments ... across ${countryName}`
}

export interface CtaBlock extends BlockBase {
  type: "cta";
  // Signed-in vs signed-out variants stay auth-driven; editable copy:
  headingSignedOut?: string | null;  // default: "Ready to Join?"
  bodySignedOut?: string | null;     // default: `Connect with the ${nationality} Claude Code community...`
  ctaLabelSignedOut?: string | null; // default: "Join the Community"
  // [review] default body uses config.NATIONALITY (e.g. "Australian"), NOT
  // countryName ("Australia") — page.tsx:427. The static /images/claude-haiku.png
  // on the right (page.tsx:440) is NOT a field; the renderer hardcodes it as today.
}

/**
 * The single generic block — the "add your own content" capability (KEPT in v1:
 * the user requirement is explicitly "add their own sections, their own content";
 * editing existing blocks alone doesn't satisfy that). Body is PLAIN TEXT only in
 * v1 — never raw HTML. No default home content uses it; it exists for net-new
 * tenant content.
 */
export interface RichTextBlock extends BlockBase {
  type: "richText";
  heading?: string | null;
  body: string;   // rendered as plain text (whitespace-pre-line); see Security
}

export type Block =
  | HeroBlock | WebinarBlock | BenefitsBlock | AudienceSplitBlock
  | EventsBlock | DiscordBlock | GalleryBlock | CtaBlock | RichTextBlock;

export interface PageSections {
  blocks: Block[];
}
```

## Default / seed content strategy (no-blank-page guarantee)

Two **distinct** layers — keep them separate or the rules contradict each other.

1. **`DEFAULT_HOME_SECTIONS` (code fallback, generic baseline).** A constant in
   `src/lib/cms/defaults.ts`. Used **whenever no `Page` row exists** (and to
   backfill a missing block). It reproduces today's structure with
   **config-derived** copy (all override fields null/empty so the renderer
   computes the current strings). In this generic baseline the **webinar block
   is `enabled: false`** and the gallery block is present (it self-hides when
   `config.galleryImages` is empty). This means a brand-new tenant with no row
   renders a **non-crashing**, non-blank page with zero region checks.
   **[review] Not "correct" copy for an empty-config tenant:** `countryName`/
   `nationality` default to `""`, so the badge renders `"'s Claude Code
   Community"`. Pre-existing behavior — a real tenant fills those via settings.

2. **Per-tenant seed/backfill row (the AU/NZ specifics).** A `Page` row written
   for existing tenants. The **AU-specific facts** — webinar bar **enabled** with
   today's title/description/href/thumbnail, and the Melbourne gallery — live
   **in AU's seed row**, NOT in the code fallback. That is how we honor "webinar
   default-enabled only where it is today" **without** a `REGION === "au"`
   check. NZ's seed row carries `webinar.enabled = false`.

**Byte-for-byte guarantee:** because hero/benefits/etc. defaults are
config-derived and identical to today's hardcoded-but-interpolated strings,
rendering `DEFAULT_HOME_SECTIONS` for AU (plus AU's seeded webinar+gallery)
reproduces the current page in spirit. The seed step is what flips webinar on for
AU; everything else falls out of the defaults.

**Implementation of the seed:** extend the existing per-tenant seed path
`scripts/seed-tenant.ts <slug>` (already region-keyed: `au`/`nz`, piped to
`wrangler d1 execute` via the `*:d1:seed-tenant` package scripts) to also emit an
idempotent **`INSERT OR IGNORE`** for the `home` `Page` row. **[review] Use
`INSERT OR IGNORE`, not `ON CONFLICT(...)`** — that's the idiom the script
already uses for `Tenant`/`TenantSetting`, and it doesn't depend on the unique
index's name.

**[review] The webinar content has NO existing source.** The webinar
`title`/`description`/`href`/`thumbnailUrl` are hardcoded in `page.tsx:281-286`
+ `:153`, NOT in `REGION_CONFIGS`. So the seed script cannot "derive" it — define
the AU webinar block as an explicit hardcoded constant in the seed (and in
`DEFAULT_HOME_SECTIONS` the webinar block is present but `enabled:false`, with the
same fields, so the shape matches). NZ seeds the same block `enabled:false`.

Brand-new tenants (online provisioning via `provisionTenant()` /
`provisionTenantByEmail()` in `src/lib/services/tenants.ts` — **[review] note:
`scripts/provision-tenant.ts` is a `--local` dev helper, not the production
path**) simply rely on the code fallback until first edit. No row is written at
provision time in v1 (smaller seed surface; both are safe).

## Rendering plan

`src/app/t/[tenant]/page.tsx` becomes a **block iterator**.

1. **Load:** a new request-memoized loader `getHomeSections()` in
   `src/lib/cms/home.ts` (React `cache()`, same pattern as `getTenantConfig`):
   reads the scoped `Page` row for `key="home"` via `getPrisma()`, parses +
   validates `sections`, and returns `DEFAULT_HOME_SECTIONS` when absent/invalid.
   A malformed/unparseable row coerces to the default (never throw to the
   visitor). **[review] Unknown block types on READ are skipped (not rendered)
   but PRESERVED in the array so a subsequent save round-trips them — no silent
   destruction. On SAVE, the service rejects a payload containing unknown types
   with a `ServiceError` rather than dropping them.** This is a conscious closed-
   library invariant, stated here so it isn't a surprise during a partial rollout.
2. **Render:** map over `blocks`, skip `enabled === false`, and switch on `type`
   to a per-block component (`src/components/home/blocks/*`). Each component
   receives its typed block plus the already-loaded `tenantConfig` so it can fill
   null overrides with config-derived strings. **[review] The page is dynamic
   today because it calls `auth()` — it has NO `export const dynamic` (only the
   admin settings page does). Keep relying on `auth()`; adding an explicit
   `force-dynamic` is optional, not a status-quo fact.**
3. **Special cases:**
   - **`events`** → renders the existing client `EventsSection`
     (`src/components/EventsSection.tsx`) unchanged. The block is a position
     marker only. **[review] The `#events` anchor that the hero CTA targets lives
     INSIDE `EventsSection` (its own `id="events"`), not in `page.tsx`. Keep
     rendering `EventsSection` as a component — do NOT inline the events markup
     into a generic block, or the anchor (and the "View Upcoming Events" jump)
     breaks.**
   - **`gallery`** → reads `config.galleryImages` exactly as today and renders
     nothing when the array is empty (preserves the current self-hide). The block
     only supplies the heading/subheading + enable flag.
   - **`webinar`** → renders `WebinarPromoBar` from the block's own structured
     fields. **No `REGION === "au"` check** — visibility is purely
     `block.enabled` (seeded on for AU only). This removes the existing
     `REGION === "au"` gate from the home page; note `src/lib/region.ts` is
     mid-deprecation, so we do not add new coupling to it.
   - **`discord`** → href defaults to `discordCommunityInvite()` from config.
   - Auth-dependent pieces (signed-in hero banner, CTA signed-in variant) stay
     code-driven inside the relevant block components.

## Metadata / SEO coupling plan

`generateMetadata()` and `buildJsonLd()` live in the same file and currently
derive description/OG from config. To prevent drift from the visible hero:

- Both functions and the page component call the **same** `getHomeSections()`
  loader (request-memoized, so one DB read). Metadata reads the **resolved** hero
  fields (override-or-config-default) for the **description and OpenGraph/Twitter
  description** strings, so the meta description matches what the hero renders.
- **Intentional exception — keep it:** the SERP `<title>`
  (`${communityName} | Claude Code Meetups`, `absolute`) is deliberately
  different from the hero `h1` (FAT P2 audit, ~60-char SERP limit). Metadata
  `title` and JSON-LD `name` stay **config-derived** and are NOT forced to equal
  the hero heading. Document this so an implementer doesn't "fix" the title to
  match the h1.
- `ogImage`, `siteUrl`, `linkedinUrl`, `lang`, `majorCities` continue to come
  from `getTenantConfig()` — unchanged.
- **[review] JSON-LD injection boundary (hard rule):** hero override strings flow
  to `<meta>` attributes ONLY (Next escapes attribute values). They must **NOT**
  be piped into `buildJsonLd()`, which serializes via bare `JSON.stringify` into a
  `<script type="application/ld+json">` (`page.tsx:166-169`). `JSON.stringify`
  does not neutralize a literal `</script>` in tenant text — routing tenant
  strings there is a stored-XSS vector. JSON-LD `name`/`description` stay
  config-derived. (The existing `dangerouslySetInnerHTML` there is safe only
  because its input is static config, never tenant content.)

## Admin editor UX

New route `src/app/t/[tenant]/admin/pages/page.tsx` (+ `actions.ts`,
`PagesClient.tsx`), modeled on the settings precedent
(`src/app/t/[tenant]/admin/settings/*`): plain `useState` forms, **no**
react-hook-form/shadcn, dark theme tokens (`#1C1917` / `#2D2926` / `#D4836A` /
`#A8A29E`).

- **Sections list:** ordered list of the home blocks. Each row shows the block
  label, an **enable/disable** toggle, and **up/down** reorder controls (no
  drag-and-drop in v1). Markers (`events`) show as non-editable position rows.
- **Per-block forms:** expand a row to edit its typed fields (text inputs +
  textareas; repeatable card editors for `benefits`/`audienceSplit`; icon picker
  constrained to the lucide allowlist). Image fields (webinar thumbnail) use
  `uploadFile(file, { folder })` + `resizeImage` from `@/lib/upload-client`.
- **Save:** one **server action** `saveHomePage(input)` in the route's
  `actions.ts` (NOT a flat `/api` route — under path-prefix tenancy a server
  action stays in the URL tenant's scope and `getTenantId()` resolves correctly;
  a flat `/api/*` call would mis-scope). It re-validates permission + payload
  server-side and writes via a service (below).
- **Nav:** add a "Home page" entry to `adminNavItems`
  (`src/components/admin/adminNavItems.ts`). **[review] `section: "Content"`
  ALREADY EXISTS** (Posts/Events/Courses/Speakers) — append to it, do NOT create
  a second "Content" header. Use `permission: "pages.view"`, an icon (e.g.
  `FileText` — already imported; or `LayoutTemplate`), `href: "/admin/pages"`.
- Gate every action-bearing element with `<Can permission="pages.edit">`.

## Security

1. **No raw HTML injection (XSS).** Tenant content is structured fields only.
   `richText.body` renders as **plain text** (e.g. `whitespace-pre-line` for line
   breaks), or — if a formatting subset is later wanted — through a known
   sanitizing renderer with a tiny allowlist (bold/italic/link). **Never**
   `dangerouslySetInnerHTML` of tenant input. (Contrast: the existing
   `dangerouslySetInnerHTML` in `page.tsx` is the JSON-LD `<script>`, built
   server-side from static config via `JSON.stringify` with no tenant input — the
   standard Next structured-data pattern, not a precedent for rendering tenant
   HTML.)
2. **Constrained enums/links.** `icon` fields validate against a fixed lucide
   allowlist; `href`/CTA links validate as internal paths (or an
   `isStorageUrl`-style allowlist for external) so a block can't inject
   `javascript:` URLs.
3. **Tenant scoping.** All reads/writes use `getPrisma()`; `Page` is registered
   in `TENANT_SCOPED_MODELS` so `tenantId` is auto-injected (fail-closed). The
   save action resolves the tenant via `getTenantId()`, never from client input.
4. **Server-side enforcement (two layers, [review] de-conflicted).** `<Can>` is
   UX only. The **server action** (`saveHomePage`) gates with
   `hasPermission(actor, "pages.edit")` + `!actor.isBanned` exactly like
   `settings/actions.ts`. The **service** (`src/lib/services/pages.ts`) is the
   defense-in-depth layer: it calls `ensurePermission(actor, "pages.edit")` (the
   `badges.ts` pattern — `ensurePermission` lives in `src/lib/services/_auth.ts`,
   `ServiceError` in `src/lib/services/_errors.ts`; both confirmed to exist) and
   re-validates the block payload (shape, enum membership, array bounds, reject
   unknown types) before persisting. API/MCP cannot import prisma directly (ESLint
   lockdown) — persistence goes through the service.

## Conventions checklist (exact files to touch)

- [ ] `prisma/schema.prisma` — add the `Page` model; run `bun run d1:generate`
      to produce a `migrations/` diff.
- [ ] `src/lib/tenant-models.ts` — add `"Page"` to `TENANT_SCOPED_MODELS`.
- [ ] `src/lib/permissions.ts` — add `pages.view` / `pages.edit` to
      `PERMISSIONS` and a "Content" entry in `PERMISSION_GROUPS`.
- [ ] `src/lib/cms/blocks.ts` — the `Block` union + `PageSections` types.
- [ ] `src/lib/cms/defaults.ts` — `DEFAULT_HOME_SECTIONS`.
- [ ] `src/lib/cms/home.ts` — `getHomeSections()` request-memoized loader +
      validation.
- [ ] `src/lib/services/pages.ts` — service: load/save with `ensurePermission`,
      payload validation, `ServiceError`.
- [ ] `src/components/home/blocks/*` — one component per block type.
- [ ] `src/app/t/[tenant]/page.tsx` — iterate blocks; remove the
      `REGION === "au"` webinar gate; metadata reads `getHomeSections()`.
- [ ] `src/app/t/[tenant]/admin/pages/{page.tsx,actions.ts,PagesClient.tsx}` —
      editor + `saveHomePage` server action.
- [ ] `src/components/admin/adminNavItems.ts` — "Home page" item under
      `section: "Content"`.
- [ ] `scripts/seed-tenant.ts` — emit the idempotent `home` `Page` row
      (AU: webinar+gallery on; NZ: webinar off).
- [ ] `bun run check` clean (Biome + ESLint + `tsc`); zero new warnings.

## Migration / seed / rollout

1. **Schema:** add `Page`, register it, `bun run d1:generate` → review the
   migration → `local:d1:migrate`, then `staging:` / `production:` per region
   (and the `nz:` variants).
2. **[review] SEED BEFORE (or with) the page deploy — ordering matters for AU.**
   The old webinar gate is the build-time `REGION === "au"`; the new gate is
   `webinar.enabled`, which only exists once AU's `Page` row is seeded. If you
   deploy the new `page.tsx` to AU **first**, the webinar bar **disappears** on
   production until the seed lands — a live regression on the primary tenant. So:
   migrate → **seed `au` (webinar+gallery on) and `nz` (webinar off)** via
   `*:d1:seed-tenant` (idempotent `INSERT OR IGNORE`, safe to re-run) → **then**
   deploy `page.tsx`. For every OTHER tenant the code fallback already renders
   correctly, so seeding is only a hard prerequisite for AU's webinar/gallery.
3. **Cutover:** with AU seeded, deploying the new `page.tsx` reproduces today's
   page (hero/benefits/audience/events/discord/cta from defaults; webinar+gallery
   from AU's seed row).
4. **Rollback:** revert `page.tsx`/editor; the `Page` table can remain unused.

## Test plan (bun dev + Chrome)

- **No-row fallback:** with no `Page` row, `bun run dev` renders the full home
  page identical to today (hero/benefits/audience/events/discord/cta), webinar
  bar hidden, gallery shown only if `config.galleryImages` is non-empty.
- **AU seed parity:** after seeding `au`, the page matches today including the
  webinar bar and Melbourne gallery.
- **Edit round-trip:** as a `pages.edit` admin, change the hero heading, disable
  the benefits block, reorder CTA above Discord, save via the server action,
  reload → changes reflected. Reset a field to empty → config-derived default
  returns.
- **Metadata coupling:** override the hero body; confirm `<meta name="description">`
  / OG description (view-source) track the visible hero, while the `<title>`
  stays `${communityName} | Claude Code Meetups`.
- **Security:** put `<script>`/`javascript:` text into `richText.body` and a CTA
  link; confirm it renders inert as text / is rejected by link validation, no
  script execution (Chrome console clean).
- **Permission gating:** a user without `pages.edit` sees no editor controls and
  the save action rejects a forged request; a user without `pages.view` is
  redirected from `/admin/pages`.
- **Isolation:** CI model-map-completeness test passes (`Page` classified);
  editing tenant A's home does not affect tenant B (`getPrisma()` scoping).
- **Lint/types:** `bun run check` passes.

## Deferred / Future (not designed now)

- Draft / publish + version history.
- Multi-page management (the `key` column already enables it structurally).
- Drag-and-drop reorder polish.
- Per-section custom CSS / theming.
- A/B testing, scheduling, content i18n.
- Additional block types beyond the closed library; rich-text formatting beyond
  the constrained subset.

## Open questions / assumptions

- **A:** `key="home"` is the only key in v1; the unique `[tenantId, key]` is the
  forward seam for more pages. (Assumed from committed architecture.)
- **A:** Hero override fields are nullable and fall back to config-derived strings
  (this reconciles no-blank-page, no-new-region-coupling, and metadata coupling).
- **A:** Gallery images remain sourced from `config.galleryImages`; the gallery
  block owns only enable + headings. (Chosen for YAGNI; revisit if per-page
  galleries are ever wanted.)
- **A:** Icons are chosen from a fixed lucide allowlist rather than free text, to
  keep the field typed and avoid arbitrary imports.
- **DECIDED [review]:** `richText` ships in v1 (the "add their own content"
  requirement), **plain-text only** (smallest safe surface). The adversarial
  reviewer suggested cutting it; rejected because editing existing blocks alone
  doesn't satisfy "add their own sections, their own content." A bold/italic/link
  subset is deferred until a tenant needs it.
- **Q:** Should brand-new tenants get a `Page` row written at provision time, or
  rely on the code fallback until first edit? Both are safe; recommendation is to
  rely on the fallback and only write a row on first save (less seed surface).
