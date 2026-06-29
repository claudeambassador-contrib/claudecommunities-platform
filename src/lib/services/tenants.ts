/**
 * Tenant provisioning — the headline upside of Option A: creating a community
 * is a DB insert, not D1 creation + worker upload + an async provisioning
 * workflow (`docs/multi-tenancy-isolation-spec.md` §7). The tenant is live the
 * instant these rows commit.
 *
 * Pass the UNSCOPED platform client (`getPlatformPrisma()`): provisioning writes
 * the registry (global) plus the new tenant's first tenant-scoped rows (system
 * roles, owner membership) with an explicit `tenantId`.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "@/lib/permissions";
import { getPlatformPrisma } from "@/lib/prisma";
import { parseTenantConfig, type TenantConfig } from "@/lib/tenant-config";
import { DEFAULT_LEADERBOARD_LEVELS, DEFAULT_SPACES } from "@/lib/tenant-defaults";
import { isValidTenantSlug } from "@/lib/tenant-resolve";

export interface ProvisionTenantInput {
  /** URL slug = the tenantId (immutable). */
  slug: string;
  /** Display name. */
  name: string;
  /** The owner's User id (global identity). */
  ownerUserId: string;
  /** Optional custom domain (e.g. `acme.com`) the tenant is also reachable on. */
  customDomain?: string | null;
  /** Optional initial settings JSON + analytics id. */
  config?: string;
  gaId?: string | null;
}

/** The per-tenant system roles every new tenant starts with. */
function systemRoleSeeds(tenantId: string) {
  const all = JSON.stringify(ALL_PERMISSIONS);
  return [
    { tenantId, name: SYSTEM_ROLES.SUPER_ADMIN, permissions: all, isSystem: true },
    { tenantId, name: SYSTEM_ROLES.ADMIN, permissions: all, isSystem: true },
    { tenantId, name: SYSTEM_ROLES.MEMBER, permissions: "[]", isSystem: true },
  ];
}

/**
 * Create a tenant: registry row + default settings + per-tenant system roles +
 * a creator membership (super_admin). Throws on an invalid or taken slug.
 * Returns the Tenant row.
 */
export async function provisionTenant(db: PrismaClient, input: ProvisionTenantInput) {
  const slug = input.slug.toLowerCase();
  if (!isValidTenantSlug(slug)) {
    throw new Error(`Invalid tenant slug: "${slug}" (lowercase, 2–39 chars, not reserved).`);
  }
  if (await db.tenant.findUnique({ where: { slug } })) {
    throw new Error(`Tenant slug already taken: "${slug}".`);
  }

  const customDomain = input.customDomain?.trim().toLowerCase() || null;
  if (customDomain && (await db.tenant.findUnique({ where: { customDomain } }))) {
    throw new Error(`Custom domain already taken: "${customDomain}".`);
  }
  const tenant = await db.tenant.create({
    data: { slug, name: input.name, status: "active", customDomain },
  });
  await db.tenantSetting.create({
    data: { tenantId: slug, config: input.config ?? "{}", gaId: input.gaId ?? null },
  });
  await db.role.createMany({ data: systemRoleSeeds(slug) });
  // The creator gets super_admin — the highest SEEDED role. A literal
  // role:"owner" here would resolve to ZERO permissions, since "owner" is not in
  // SYSTEM_ROLES/systemRoleSeeds (no matching Role row → getMembershipPermissions
  // returns []). Use super_admin until a distinct owner role with real semantics
  // is actually needed.
  await db.userTenant.create({
    data: { tenantId: slug, userId: input.ownerUserId, role: SYSTEM_ROLES.SUPER_ADMIN },
  });
  // Default community reference data so the tenant is usable immediately — same
  // content the CLI/platform seeds emit (src/lib/tenant-defaults.ts). Both models
  // are tenant-scoped, so stamp the slug explicitly.
  await db.space.createMany({
    data: DEFAULT_SPACES.map((s) => ({
      tenantId: slug,
      name: s.name,
      slug: s.slug,
      icon: s.icon,
      description: s.description,
      order: s.order,
    })),
  });
  await db.leaderboardLevel.createMany({
    data: DEFAULT_LEADERBOARD_LEVELS.map((l) => ({
      tenantId: slug,
      level: l.level,
      name: l.name,
      icon: l.icon,
      minPoints: l.minPoints,
      color: l.color,
    })),
  });
  return tenant;
}

export interface ProvisionTenantByEmailInput {
  slug: string;
  name: string;
  /** Owner's email — an existing User is reused, otherwise a placeholder is created. */
  ownerEmail: string;
  customDomain?: string | null;
  config?: string;
  gaId?: string | null;
}

/**
 * Online counterpart to {@link provisionTenant}: provision a tenant from the
 * owner's EMAIL rather than a resolved User id — the shape the admin
 * configurator route uses. Find-or-create the owner User (a placeholder claimed
 * on Clerk signup with that email, exactly like `scripts/provision-tenant.ts`),
 * then delegate to {@link provisionTenant}. Resolves the unscoped platform
 * client itself so the route stays behind the service-layer import lockdown.
 */
export async function provisionTenantByEmail(input: ProvisionTenantByEmailInput) {
  const db = await getPlatformPrisma();
  const email = input.ownerEmail.toLowerCase().trim();
  if (!email.includes("@")) throw new Error(`Invalid owner email: "${input.ownerEmail}".`);

  let owner = await db.user.findUnique({ where: { email } });
  if (!owner) {
    owner = await db.user.create({
      data: {
        clerkId: `provision_${input.slug.toLowerCase()}_${randomBytes(6).toString("hex")}`,
        email,
        role: "member",
        importSource: "provision",
        isOnboarded: false,
      },
    });
  }

  return provisionTenant(db, {
    slug: input.slug,
    name: input.name,
    ownerUserId: owner.id,
    customDomain: input.customDomain,
    config: input.config,
    gaId: input.gaId,
  });
}

export interface TenantSummary {
  slug: string;
  name: string;
  status: string;
  customDomain: string | null;
  listed: boolean;
  memberCount: number;
  createdAt: Date;
}

/**
 * All tenants in the registry, newest first, with their membership counts.
 * `db` defaults to the unscoped platform client; it's injectable so the
 * `groupBy` query can be exercised against a SQLite adapter in tests.
 */
export async function listTenants(client?: PrismaClient): Promise<TenantSummary[]> {
  const db = client ?? (await getPlatformPrisma());
  const tenants = await db.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await db.userTenant.groupBy({ by: ["tenantId"], _count: { userId: true } });
  const countBySlug = new Map(counts.map((c) => [c.tenantId, c._count.userId]));
  return tenants.map((t) => ({
    slug: t.slug,
    name: t.name,
    status: t.status,
    customDomain: t.customDomain,
    listed: t.listed,
    memberCount: countBySlug.get(t.slug) ?? 0,
    createdAt: t.createdAt,
  }));
}

/** A community as shown on the public platform directory (apex). */
export interface PublicCommunity {
  slug: string;
  /** Registry display name (fallback when config.communityName is unset). */
  name: string;
  communityName: string;
  countryName: string;
  /** Card image — the tenant's OG image (falls back to its hero/map image). */
  image: string;
  /** Canonical absolute URL for the community (its own domain when set). */
  siteUrl: string;
  customDomain: string | null;
  memberCount: number;
}

/**
 * The communities to render in the public directory at the platform apex:
 * `status="active"` AND `listed=true`, newest first, each merged with its
 * branding from `TenantSetting.config`. Unscoped platform read — Tenant /
 * TenantSetting are global registry models.
 */
export async function listPublicCommunities(client?: PrismaClient): Promise<PublicCommunity[]> {
  const db = client ?? (await getPlatformPrisma());
  const tenants = await db.tenant.findMany({
    where: { status: "active", listed: true },
    orderBy: { createdAt: "desc" },
  });
  const [settings, counts] = await Promise.all([
    db.tenantSetting.findMany({
      where: { tenantId: { in: tenants.map((t) => t.slug) } },
      select: { tenantId: true, config: true, gaId: true },
    }),
    db.userTenant.groupBy({ by: ["tenantId"], _count: { userId: true } }),
  ]);
  const configBySlug = new Map(
    settings.map((s) => [s.tenantId, parseTenantConfig(s.config, s.gaId)]),
  );
  const countBySlug = new Map(counts.map((c) => [c.tenantId, c._count.userId]));
  return tenants.map((t) => {
    const cfg = configBySlug.get(t.slug);
    return {
      slug: t.slug,
      name: t.name,
      communityName: cfg?.communityName || t.name,
      countryName: cfg?.countryName ?? "",
      image: cfg?.ogImage || cfg?.mapImage || "",
      siteUrl: cfg?.siteUrl ?? "",
      customDomain: t.customDomain,
      memberCount: countBySlug.get(t.slug) ?? 0,
    };
  });
}

export interface BootstrapHomeTenantInput {
  /** The home-region slug = tenantId (e.g. "au" / "nz"). */
  slug: string;
  /** Display name for the registry row. */
  name: string;
  /** Optional initial settings JSON + analytics id. */
  config?: string;
  gaId?: string | null;
}

export interface BootstrapResult {
  slug: string;
  tenantCreated: boolean;
  /** New UserTenant rows written this run (0 on a re-run). */
  membershipsBackfilled: number;
  totalUsers: number;
}

/**
 * One-time bootstrap of an EXISTING single-tenant deployment into the tenant
 * model: ensure the registry + settings rows and the canonical system roles,
 * then enroll EVERY existing user as a member of this tenant with their current
 * global `User.role`. This is the prerequisite for membership-based authz
 * (`UserTenant.role`) and for any `User` list scoped via the membership join.
 *
 * Idempotent — `upsert` + `createMany({ skipDuplicates })` against the
 * `@@unique([tenantId, userId])` make it safe to re-run. Distinct from
 * `provisionTenant` (a NEW tenant with a single owner): this preserves the
 * whole existing user base and their roles.
 *
 * Run once per deployment via the admin endpoint, with the deploy's home slug
 * (`au` / `nz`). NZ is a separate D1, so its bootstrap is a separate call —
 * never reuse one region's slug against another region's database.
 *
 * Uses the unscoped platform client: it writes the registry (global) and the
 * tenant's first scoped rows with an explicit `tenantId`.
 */
export async function bootstrapHomeTenant(
  db: PrismaClient,
  input: BootstrapHomeTenantInput,
): Promise<BootstrapResult> {
  const slug = input.slug.toLowerCase();
  if (!isValidTenantSlug(slug)) {
    throw new Error(`Invalid tenant slug: "${slug}" (lowercase, 2–39 chars, not reserved).`);
  }

  const existing = await db.tenant.findUnique({ where: { slug } });
  await db.tenant.upsert({
    where: { slug },
    create: { slug, name: input.name, status: "active" },
    update: {},
  });
  await db.tenantSetting.upsert({
    where: { tenantId: slug },
    create: { tenantId: slug, config: input.config ?? "{}", gaId: input.gaId ?? null },
    update: {},
  });
  // Ensure the canonical system roles. `createMany` has no `skipDuplicates` on
  // SQLite/D1, so diff against what already exists (0021 may have backfilled
  // some) and insert only the missing ones.
  const existingRoles = new Set(
    (await db.role.findMany({ where: { tenantId: slug }, select: { name: true } })).map(
      (r) => r.name,
    ),
  );
  const missingRoles = systemRoleSeeds(slug).filter((r) => !existingRoles.has(r.name));
  if (missingRoles.length) await db.role.createMany({ data: missingRoles });

  // Enroll every not-yet-enrolled user, preserving their global role. Same
  // no-skipDuplicates constraint → diff against existing memberships, then
  // insert in chunks so a large user base stays within D1's per-statement limit.
  const enrolled = new Set(
    (await db.userTenant.findMany({ where: { tenantId: slug }, select: { userId: true } })).map(
      (m) => m.userId,
    ),
  );
  const users = await db.user.findMany({ select: { id: true, role: true } });
  const toEnroll = users.filter((u) => !enrolled.has(u.id));
  let membershipsBackfilled = 0;
  const CHUNK = 100;
  for (let i = 0; i < toEnroll.length; i += CHUNK) {
    const batch = toEnroll.slice(i, i + CHUNK);
    await db.userTenant.createMany({
      data: batch.map((u) => ({ tenantId: slug, userId: u.id, role: u.role })),
    });
    membershipsBackfilled += batch.length;
  }

  return { slug, tenantCreated: !existing, membershipsBackfilled, totalUsers: users.length };
}

/**
 * Route-facing wrapper for {@link bootstrapHomeTenant} — resolves the unscoped
 * platform client (API routes can't import `@/lib/prisma` under the lockdown).
 */
export async function runHomeTenantBootstrap(
  input: BootstrapHomeTenantInput,
): Promise<BootstrapResult> {
  return bootstrapHomeTenant(await getPlatformPrisma(), input);
}

/** A single tenant's registry row (name / customDomain / status / listed). */
export async function getTenantRegistry(slug: string) {
  const db = await getPlatformPrisma();
  return db.tenant.findUnique({
    where: { slug },
    select: { slug: true, name: true, customDomain: true, status: true, listed: true },
  });
}

/** Suspend / reactivate a tenant (middleware serves 503 for suspended). */
export async function setTenantStatus(
  db: PrismaClient,
  slug: string,
  status: "active" | "suspended",
) {
  return db.tenant.update({ where: { slug }, data: { status } });
}

export interface UpdateTenantInput {
  name?: string;
  customDomain?: string | null;
  status?: "active" | "suspended";
  listed?: boolean;
}

/**
 * Platform-console edit of a tenant's REGISTRY row (name / custom domain /
 * status / directory visibility). The slug is immutable and never updated here.
 * Resolves the unscoped platform client itself (Tenant is a global registry
 * model). Validates the custom domain isn't taken by another tenant.
 */
export async function updateTenant(slug: string, input: UpdateTenantInput) {
  const db = await getPlatformPrisma();
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.status !== undefined) data.status = input.status;
  if (input.listed !== undefined) data.listed = input.listed;
  if (input.customDomain !== undefined) {
    const customDomain = input.customDomain?.trim().toLowerCase() || null;
    if (customDomain) {
      const clash = await db.tenant.findUnique({ where: { customDomain } });
      if (clash && clash.slug !== slug) {
        throw new Error(`Custom domain already taken: "${customDomain}".`);
      }
    }
    data.customDomain = customDomain;
  }
  return db.tenant.update({ where: { slug }, data });
}

/**
 * Tenant self-service edit of a community's CONFIG — everything except the slug.
 * Writes the merged `TenantSetting.config` JSON plus the broken-out
 * `gaId`/`fromEmail`/`senderDomain` columns, and the registry `name` /
 * `customDomain` on the `Tenant` row. Pass a partial `TenantConfig`; it's merged
 * over the stored config so callers only send changed fields.
 *
 * Unscoped platform client: TenantSetting/Tenant are global registry models
 * keyed by slug. Callers MUST authorize `tenant.settings` for THIS tenant before
 * invoking (the API route / page gate does this).
 */
export async function updateTenantConfig(
  slug: string,
  input: { config: Partial<TenantConfig>; name?: string; customDomain?: string | null },
) {
  const db = await getPlatformPrisma();
  const existing = await db.tenantSetting.findUnique({ where: { tenantId: slug } });
  const current = parseTenantConfig(existing?.config, existing?.gaId ?? null);
  const merged: TenantConfig = { ...current, ...input.config };

  await db.tenantSetting.upsert({
    where: { tenantId: slug },
    create: {
      tenantId: slug,
      config: JSON.stringify(merged),
      gaId: merged.gaId,
      fromEmail: merged.fromEmail,
      senderDomain: merged.senderDomain,
    },
    update: {
      config: JSON.stringify(merged),
      gaId: merged.gaId,
      fromEmail: merged.fromEmail,
      senderDomain: merged.senderDomain,
    },
  });

  if (input.name !== undefined || input.customDomain !== undefined) {
    await updateTenant(slug, { name: input.name, customDomain: input.customDomain });
  }
  return merged;
}
