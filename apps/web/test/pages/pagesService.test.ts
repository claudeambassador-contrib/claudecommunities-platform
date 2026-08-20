import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_SECTIONS } from "@/modules/pages/homeDefaults";
import { listIndustries, saveIndustry } from "@/modules/pages/services/industriesService";
import {
  createContentPage,
  deleteContentPage,
  getContentPage,
  getHomeSections,
  getPublishedPage,
  listContentPages,
  listPublishedPages,
  saveHomeSections,
  updateContentPage,
} from "@/modules/pages/services/pagesService";
import type { Block, ContentPageInput, RichTextBlock } from "@/modules/pages/types";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

function textBlock(id: string, body = "Hello", heading: string | null = null): RichTextBlock {
  return { body, enabled: true, heading, id, type: "richText" };
}

function pageInput(overrides: Partial<ContentPageInput> = {}): ContentPageInput {
  return {
    blocks: [textBlock("blk_1", "Welcome")],
    slug: "about",
    title: "About us",
    ...overrides,
  };
}

describe("pagesService content pages", () => {
  it("creates a content page and lists it without the home row", async () => {
    const store = openMemoryTenant();
    const created = await createContentPage(store, adminActor(), pageInput({ slug: "zeta" }));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.page.slug).toBe("zeta");
    expect(created.page.title).toBe("About us");
    expect(created.page.status).toBe("draft");

    await createContentPage(store, adminActor(), pageInput({ slug: "alpha", title: "Alpha" }));
    await saveHomeSections(store, adminActor(), [
      { enabled: true, heading: "City", id: "hero_1", type: "hero" },
    ]);

    const listed = await listContentPages(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.pages.map((p) => p.slug)).toEqual(["alpha", "zeta"]);

    await updateContentPage(store, adminActor(), created.page.id, {
      ...pageInput({ slug: "zeta", title: "Zeta live" }),
      status: "published",
    });
    const published = await listPublishedPages(store);
    expect(published.ok && published.pages.map((page) => page.slug)).toEqual(["zeta"]);
  });

  it("rejects create without pages.edit, reserved home slug, and duplicates", async () => {
    const store = openMemoryTenant();
    const denied = await createContentPage(store, memberActor(), pageInput());
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const reserved = await createContentPage(store, adminActor(), pageInput({ slug: "home" }));
    expect(reserved.ok).toBe(false);
    if (!reserved.ok) {
      expect(reserved.error.status).toBe(400);
    }

    const first = await createContentPage(store, adminActor(), pageInput({ slug: "dup" }));
    expect(first.ok).toBe(true);
    const clash = await createContentPage(
      store,
      adminActor(),
      pageInput({ slug: "dup", title: "B" }),
    );
    expect(clash.ok).toBe(false);
    if (!clash.ok) {
      expect(clash.error.status).toBe(409);
    }
  });

  it("validates nested slugs, title, and richText-only content blocks", async () => {
    const store = openMemoryTenant();
    const badSegment = await createContentPage(
      store,
      adminActor(),
      pageInput({ slug: "About Us" }),
    );
    expect(badSegment.ok).toBe(false);

    const tooDeep = await createContentPage(
      store,
      adminActor(),
      pageInput({ slug: "a/b/c/d/e/f" }),
    );
    expect(tooDeep.ok).toBe(false);

    const nested = await createContentPage(
      store,
      adminActor(),
      pageInput({ slug: "/Guides/Getting-Started/" }),
    );
    expect(nested.ok).toBe(true);
    if (!nested.ok) {
      return;
    }
    expect(nested.page.slug).toBe("guides/getting-started");

    const emptyTitle = await createContentPage(store, adminActor(), pageInput({ title: "  " }));
    expect(emptyTitle.ok).toBe(false);

    const heroOnContent = await createContentPage(
      store,
      adminActor(),
      pageInput({
        blocks: [
          textBlock("ok_1"),
          { body: "x", enabled: true, heading: null, id: "h1", type: "hero" },
        ],
        slug: "bad-blocks",
      }),
    );
    expect(heroOnContent.ok).toBe(false);
    if (!heroOnContent.ok) {
      // second block (index 1) is the offender — message must carry both the
      // path/index and the domain reason, not just a bare zod string
      expect(heroOnContent.error.message).toContain("1.type");
      expect(heroOnContent.error.message).toContain(
        "only text sections are allowed on content pages",
      );
    }
  });

  it("loads, updates, and deletes a content page, but not home", async () => {
    const store = openMemoryTenant();
    const created = await createContentPage(store, adminActor(), pageInput());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const loaded = await getContentPage(store, adminActor(), created.page.id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.page.blocks).toEqual([textBlock("blk_1", "Welcome")]);

    const updated = await updateContentPage(store, adminActor(), created.page.id, {
      blocks: [textBlock("blk_2", "Updated", "Heading")],
      slug: "about-team",
      status: "published",
      title: "About the team",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.page.slug).toBe("about-team");
    expect(updated.page.status).toBe("published");

    const badStatus = await createContentPage(
      store,
      adminActor(),
      pageInput({ status: "archived" as unknown as ContentPageInput["status"] }),
    );
    expect(badStatus.ok).toBe(false);

    const other = await createContentPage(store, adminActor(), pageInput({ slug: "taken" }));
    expect(other.ok).toBe(true);
    const taken = await updateContentPage(
      store,
      adminActor(),
      created.page.id,
      pageInput({ slug: "taken" }),
    );
    expect(taken.ok).toBe(false);
    if (!taken.ok) {
      expect(taken.error.status).toBe(409);
    }

    const badUpdateStatus = await updateContentPage(store, adminActor(), created.page.id, {
      ...pageInput(),
      status: "archived" as unknown as ContentPageInput["status"],
    });
    expect(badUpdateStatus.ok).toBe(false);

    const home = await saveHomeSections(store, adminActor(), [
      { enabled: true, id: "hero_1", type: "hero" },
    ]);
    expect(home.ok).toBe(true);
    const publishedHome = await getPublishedPage(store, "home");
    expect(publishedHome.ok).toBe(true);
    if (!(publishedHome.ok && publishedHome.page)) {
      return;
    }
    const asContent = await getContentPage(store, adminActor(), publishedHome.page.id);
    expect(asContent.ok).toBe(false);
    const deleteHome = await deleteContentPage(store, adminActor(), publishedHome.page.id);
    expect(deleteHome.ok).toBe(false);

    const removed = await deleteContentPage(store, adminActor(), created.page.id);
    expect(removed.ok).toBe(true);
    const gone = await getContentPage(store, adminActor(), created.page.id);
    expect(gone.ok).toBe(false);
  });
});

describe("pagesService home and public read", () => {
  it("saves home sections and only serves published pages publicly", async () => {
    const store = openMemoryTenant();
    const draft = await createContentPage(store, adminActor(), pageInput({ slug: "city" }));
    expect(draft.ok).toBe(true);

    const hidden = await getPublishedPage(store, "city");
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) {
      return;
    }
    expect(hidden.page).toBeNull();

    if (!draft.ok) {
      return;
    }
    await updateContentPage(store, adminActor(), draft.page.id, {
      ...pageInput({ slug: "city" }),
      status: "published",
    });
    const live = await getPublishedPage(store, "city");
    expect(live.ok).toBe(true);
    if (!live.ok) {
      return;
    }
    expect(live.page?.title).toBe("About us");
    expect(live.page?.blocks).toHaveLength(1);

    const blocks: Block[] = [
      { body: "Join us", enabled: true, heading: "Welcome", id: "rt_1", type: "richText" },
      { enabled: true, id: "ev_1", type: "events" },
    ];
    const saved = await saveHomeSections(store, adminActor(), blocks);
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    expect(saved.blocks).toEqual(blocks);

    const home = await getPublishedPage(store, "home");
    expect(home.ok).toBe(true);
    if (!home.ok) {
      return;
    }
    expect(home.page?.slug).toBe("home");
    expect(home.page?.blocks).toEqual(blocks);

    const again = await saveHomeSections(store, adminActor(), [
      { enabled: true, heading: "Updated home", id: "hero_2", type: "hero" },
    ]);
    expect(again.ok).toBe(true);
    const reread = await getPublishedPage(store, "home");
    expect(reread.ok).toBe(true);
    if (!reread.ok) {
      return;
    }
    expect(reread.page?.blocks[0]).toMatchObject({ heading: "Updated home", type: "hero" });
  });

  it("returns code default home sections when no published home exists", async () => {
    const store = openMemoryTenant();
    const missing = await getHomeSections(store);
    expect(missing.ok).toBe(true);
    if (missing.ok) {
      expect(missing.blocks).toEqual(DEFAULT_HOME_SECTIONS);
    }
  });

  it("coerces missing cards so a heading-only save can succeed", async () => {
    const store = openMemoryTenant();
    const now = new Date();
    await store.db.insert(store.tables.pages).values({
      bodyJson: JSON.stringify({
        blocks: [{ enabled: true, heading: "Why", id: "benefits", type: "benefits" }],
      }),
      createdAt: now,
      id: "pg_home",
      orgId: store.orgId,
      slug: "home",
      status: "published",
      title: "Home",
      updatedAt: now,
    });
    const loaded = await getHomeSections(store);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.blocks[0]).toMatchObject({ cards: [], id: "benefits", type: "benefits" });
    const saved = await saveHomeSections(store, adminActor(), loaded.blocks);
    expect(saved.ok).toBe(true);
  });

  it("rejects unknown home blocks, unsafe links, and member home edits", async () => {
    const store = openMemoryTenant();
    const denied = await saveHomeSections(store, memberActor(), [
      { enabled: true, id: "hero_1", type: "hero" },
    ]);
    expect(denied.ok).toBe(false);

    const unknown = await saveHomeSections(store, adminActor(), [
      { enabled: true, id: "x1", type: "mystery" } as unknown as Block,
    ]);
    expect(unknown.ok).toBe(false);

    const badAtIndex = await saveHomeSections(store, adminActor(), [
      { enabled: true, id: "hero_1", type: "hero" },
      { enabled: true, id: "x2", type: "mystery" } as unknown as Block,
    ]);
    expect(badAtIndex.ok).toBe(false);
    if (!badAtIndex.ok) {
      // admin-visible message must show which block (index 1) failed, not
      // just a bare zod string with no location
      expect(badAtIndex.error.message).toContain("1.");
    }

    const unsafe = await saveHomeSections(store, adminActor(), [
      {
        description: "Talk",
        enabled: true,
        href: "javascript:alert(1)",
        id: "w1",
        thumbnailUrl: "https://example.com/t.png",
        title: "Webinar",
        type: "webinar",
      },
    ]);
    expect(unsafe.ok).toBe(false);

    const listed = await listContentPages(store, memberActor());
    expect(listed.ok).toBe(false);
  });
});

describe("industriesService", () => {
  it("lists built-ins and saves an override page", async () => {
    const store = openMemoryTenant();
    const listed = await listIndustries(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.industries.some((row) => row.slug === "saas" && !row.custom)).toBe(true);

    const saved = await saveIndustry(store, adminActor(), {
      body: "SaaS teams ship faster.",
      slug: "saas",
      title: "SaaS override",
    });
    expect(saved.ok).toBe(true);
    const again = await listIndustries(store, adminActor());
    expect(again.ok).toBe(true);
    if (again.ok) {
      const saas = again.industries.find((row) => row.slug === "saas");
      expect(saas?.custom).toBe(true);
      expect(saas?.title).toBe("SaaS override");
    }
  });
});
