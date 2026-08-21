import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { listCitiesAdmin } from "@/modules/cities/services/citiesService";
import { listFeed, listSpaces } from "@/modules/community/services/communityService";
import { listPublished, listPublishedScheduled } from "@/modules/courses/services/coursesService";
import { listCampaigns } from "@/modules/email/services/emailCampaignsService";
import { listEvents, listPublicAgenda } from "@/modules/events/services/eventsService";
import {
  findByClerkId,
  findByEmail,
  findMembership,
} from "@/modules/identity/repositories/usersRepository";
import { getHomeSections, listPublishedPages } from "@/modules/pages/services/pagesService";
import { listAccounts, listPosts } from "@/modules/social/services/socialService";
import { listSpeakers } from "@/modules/talks/services/talksService";
import { buildCitySeed } from "@/modules/tenants/seed/citySeed";
import { listPublicTiers } from "@/modules/tiers/services/tiersService";
import { createRegistrySchema } from "@/shared/db/registrySchema";
import { registryStore } from "@/shared/db/registryStore";
import { createTenantSchema } from "@/shared/db/tenantSchema";
import { tenantStore } from "@/shared/db/tenantStore";

import { ownerActor } from "../helpers/tenant";

const NOW = 1_800_000_000_000;
const ORG = "org_seed";
const INSERT_OR_IGNORE = /INSERT OR IGNORE/i;

function applyMigrations(sqlite: Database.Database, dir: string): void {
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(join(dir, file), "utf-8"));
  }
}

function openSeeded() {
  const tenantSqlDir = resolve(import.meta.dirname, "../../drizzle/tenant");
  const registrySqlDir = resolve(import.meta.dirname, "../../drizzle/registry");
  const seed = buildCitySeed({
    now: NOW,
    orgId: ORG,
    ownerEmail: "jack@example.com",
  });

  const tenantSqlite = new Database(":memory:");
  applyMigrations(tenantSqlite, tenantSqlDir);
  tenantSqlite.exec(seed.tenantSql);
  const store = tenantStore(drizzle(tenantSqlite, { schema: createTenantSchema() }) as never, {
    binding: "TENANT_TEST",
    orgId: ORG,
  });

  const registrySqlite = new Database(":memory:");
  applyMigrations(registrySqlite, registrySqlDir);
  registrySqlite.exec(seed.registrySql);
  const registry = registryStore(
    drizzle(registrySqlite, { schema: createRegistrySchema() }) as never,
  );

  return { registry, seed, store, tenantSqlite };
}

describe(buildCitySeed, () => {
  it("seeds spaces, catalog rows, a published event, feed posts, home blocks, and cities", async () => {
    const { store } = openSeeded();

    const spaces = await listSpaces(store);
    expect(spaces.ok).toBeTruthy();
    if (!spaces.ok) {
      return;
    }
    expect(spaces.spaces.map((space) => space.slug)).toStrictEqual([
      "announcements",
      "say-hello",
      "general",
      "show-tell",
      "tips-tricks",
      "help",
    ]);

    const published = await listEvents(store);
    expect(published.ok).toBeTruthy();
    if (!published.ok) {
      return;
    }
    expect(published.events).toHaveLength(1);
    expect(published.events[0]?.status).toBe("published");
    expect(published.events[0]?.startTime).toBe(new Date(NOW + 14 * 86_400_000).toISOString());

    const allEvents = await listEvents(store, { includeInactive: true });
    expect(allEvents.ok && allEvents.events.map((event) => event.status).sort()).toStrictEqual([
      "draft",
      "published",
    ]);

    const feed = await listFeed(store);
    expect(feed.ok && feed.posts.length).toBeGreaterThanOrEqual(2);

    const home = await getHomeSections(store);
    const hero = home.ok ? home.blocks.find((block) => block.type === "hero") : null;
    expect(hero && "heading" in hero ? hero.heading : null).toBe("Welcome to the seeded city");

    const cities = await listCitiesAdmin(store, ownerActor());
    expect(cities.ok && cities.cities.map((city) => city.slug)).toStrictEqual([
      "sydney",
      "melbourne",
    ]);

    const agenda = await listPublicAgenda(store, "evt_seed_published");
    expect(agenda.ok && agenda.items.map((item) => item.title)).toStrictEqual([
      "Doors + welcome",
      "Live coding with Claude Code",
    ]);

    const courses = await listPublished(store);
    expect(courses.ok && courses.courses.map((course) => course.slug)).toStrictEqual([
      "intro-to-claude-code",
    ]);
    const workshops = await listPublishedScheduled(store);
    expect(workshops.ok && workshops.courses[0]?.registrationUrl).toContain("example.com/register");

    const resources = await listPublishedPages(store);
    expect(resources.ok && resources.pages.map((page) => page.slug).sort()).toStrictEqual([
      "for/ecommerce",
      "getting-started",
    ]);

    const tiers = await listPublicTiers(store);
    expect(tiers.ok && tiers.tiers.map((tier) => tier.slug)).toStrictEqual(["community", "member"]);

    const campaigns = await listCampaigns(store, ownerActor());
    expect(campaigns.ok && campaigns.campaigns.map((row) => row.name)).toStrictEqual([
      "Welcome to the city",
    ]);

    const speakers = await listSpeakers(store, ownerActor(), "evt_seed_published");
    expect(speakers.ok && speakers.speakers.map((row) => row.name)).toStrictEqual(["Ada Lovelace"]);

    const accounts = await listAccounts(store, ownerActor());
    const posts = await listPosts(store, ownerActor());
    expect(accounts.ok && accounts.accounts).toHaveLength(1);
    expect(posts.ok && posts.posts).toHaveLength(1);
  });

  it("seeds Ada as a member and claims the owner email via invite_ clerk id", async () => {
    const { registry } = openSeeded();

    const ada = await findByEmail(registry.db, "ada@example.com");
    expect(ada?.clerkUserId.startsWith("invite_")).toBeTruthy();
    expect(ada && (await findMembership(registry.db, ada.id, ORG))?.role).toBe("member");

    const owner = await findByEmail(registry.db, "jack@example.com");
    expect(owner?.clerkUserId.startsWith("invite_")).toBeTruthy();
    expect(owner && (await findMembership(registry.db, owner.id, ORG))?.role).toBe("owner");
    expect(owner && (await findByClerkId(registry.db, owner.clerkUserId))?.email).toBe(
      "jack@example.com",
    );
  });

  it("is idempotent and stamps org_id on every tenant insert", () => {
    const { seed, tenantSqlite } = openSeeded();
    expect(seed.tenantSql).toMatch(INSERT_OR_IGNORE);
    expect(seed.registrySql).toMatch(INSERT_OR_IGNORE);
    expect(seed.tenantSql.match(/'org_seed'/g)?.length).toBeGreaterThanOrEqual(10);

    tenantSqlite.exec(seed.tenantSql);
    const spaces = tenantSqlite.prepare("SELECT count(*) AS n FROM spaces").get() as { n: number };
    expect(spaces.n).toBe(6);
  });

  it("replaces a previously seeded owner email on re-seed", async () => {
    const first = buildCitySeed({ now: NOW, orgId: ORG, ownerEmail: "jack@example.com" });
    const second = buildCitySeed({ now: NOW + 1, orgId: ORG, ownerEmail: "e2e.admin@example.com" });
    const registrySqlite = new Database(":memory:");
    applyMigrations(registrySqlite, resolve(import.meta.dirname, "../../drizzle/registry"));
    registrySqlite.exec(first.registrySql);
    registrySqlite.exec(second.registrySql);
    const registry = registryStore(
      drizzle(registrySqlite, { schema: createRegistrySchema() }) as never,
    );

    await expect(findByEmail(registry.db, "jack@example.com")).resolves.toBeNull();
    const owner = await findByEmail(registry.db, "e2e.admin@example.com");
    expect(owner?.clerkUserId).toBe("invite_seed_owner");
    expect(owner && (await findMembership(registry.db, owner.id, ORG))?.role).toBe("owner");
  });

  it("promotes Ada to owner when the owner email is hers", async () => {
    const seed = buildCitySeed({ now: NOW, orgId: ORG, ownerEmail: "ada@example.com" });
    const registrySqlite = new Database(":memory:");
    applyMigrations(registrySqlite, resolve(import.meta.dirname, "../../drizzle/registry"));
    registrySqlite.exec(seed.registrySql);
    const registry = registryStore(
      drizzle(registrySqlite, { schema: createRegistrySchema() }) as never,
    );

    const ada = await findByEmail(registry.db, "ada@example.com");
    expect(ada && (await findMembership(registry.db, ada.id, ORG))?.role).toBe("owner");
    await expect(findByEmail(registry.db, "jack@example.com")).resolves.toBeNull();
  });
});
