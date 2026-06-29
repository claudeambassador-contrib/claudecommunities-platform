/**
 * Server-side slide-to-PNG renderer with R2 caching.
 *
 * Wraps Cloudflare Browser Rendering (`@cloudflare/puppeteer`) — connects to
 * the BROWSER binding, navigates to the signed `/internal/slide-render/...`
 * page, waits for `body[data-slide-ready="1"]`, and screenshots the
 * `#slide-root` element.
 *
 * Cache shape (per CLAUDE.md user request):
 *  - R2 key is content-addressed: `slides/render/<contentHash>.png`. Two
 *    distinct combos with identical visible content share one R2 object.
 *  - DB tracking row in `SlideRender` keyed by `(eventId, slideId, speakerId)`.
 *    When a combo's content changes, the row is rewritten with the new
 *    contentHash and r2Key; the prior R2 key is deleted iff no other row
 *    still references it.
 *  - Speaker / template / event mutations call into the invalidation helpers
 *    in `slideRenderInvalidation.ts` to purge stale rows up-front.
 *
 * Public API:
 *  - `renderSlidePng` — single-slide render-or-cache used by the admin
 *    preview route. Opens its own browser session.
 *  - `renderPairForExport` — single-pair render-or-cache used by
 *    `SlideExportWorkflow` from inside a per-pair `step.do`. Like
 *    `renderSlidePng` but returns the R2 key only (no bytes in memory) and
 *    supports `force` to bypass the content-hash cache.
 *  - `getCachedRenderIfFresh` — cache-only lookup (no browser, no DB write)
 *    used by the export POST route's short-circuit for single-pair exports.
 *
 * Local dev (no BROWSER binding): every render path throws ServiceError
 * `unavailable`. The standalone editor's export button falls back to the
 * pre-existing client-side html-to-image path when it sees a 503.
 */

import puppeteer, { type Browser, type BrowserWorker } from "@cloudflare/puppeteer";
import type { SlideEntry } from "@/components/slide-generator/persistence";
import type { SlideTemplate } from "@/components/slide-generator/types";
import { ASPECT_RATIOS } from "@/components/slide-generator/types";
import { getEnv } from "@/lib/cf-env";
import { getPrisma } from "@/lib/prisma";
import { signSlideRenderUrl } from "@/lib/slideRenderSign";
import { deleteObject, getObject, publicUrl, putBytesAtKey } from "@/lib/storage";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import { ServiceError } from "./_errors";
import { getStateInternal } from "./slideGenerator";
import { getSpeakerInternal } from "./speakers";

const RENDER_TIMEOUT_MS = 30_000;
const READY_SELECTOR = "body[data-slide-ready='1']";
const SLIDE_SELECTOR = "#slide-root";

/**
 * Width (CSS pixels) the puppeteer viewport renders the slide at. Chosen to
 * match the editor's typical preview pane size — the SlidePreview component
 * uses absolute-px font sizes (`header_font_size: 26` literally means 26px,
 * not a proportion), so rendering at this width keeps text proportions in
 * the PNG identical to the editor preview. The puppeteer screenshot is
 * upscaled to the slide's nominal `config.width` via deviceScaleFactor.
 */
export const DEFAULT_RENDER_REF_WIDTH = 600;

interface StoredStateLike {
  slides?: SlideEntry[];
  template?: SlideTemplate;
}

function pickTemplate(data: unknown, slideId: string): SlideTemplate | null {
  if (!data || typeof data !== "object") return null;
  const state = data as StoredStateLike;
  if (Array.isArray(state.slides)) {
    return state.slides.find((s) => s.id === slideId)?.template ?? null;
  }
  return state.template ?? null;
}

function getBrowserBinding(): BrowserWorker {
  const env = getEnv();
  const browser = (env as unknown as { BROWSER?: BrowserWorker }).BROWSER;
  if (!browser) {
    throw new ServiceError(
      "unavailable",
      "Server-side slide rendering is not configured on this environment (missing BROWSER binding)",
    );
  }
  return browser;
}

async function getRenderOrigin(): Promise<string> {
  return (await getTenantConfig()).appUrl;
}

/**
 * Stable subset of the template + speaker that actually affects the rendered
 * PNG. Any change in here invalidates the cached image. Intentionally
 * excludes fields that have no visual impact (DB ids, timestamps).
 */
function buildVisualFingerprint(
  template: SlideTemplate,
  speaker: SlideSpeakerSerialised,
  refWidth: number,
) {
  return {
    template,
    speaker: {
      name: speaker.name,
      title: speaker.title,
      company: speaker.company,
      talk_title: speaker.talkTitle,
      talk_description: speaker.talkDescription,
      talk_description_short: speaker.talkDescriptionShort,
      headshot_url: speaker.headshotUrl,
      company_logo_url: speaker.companyLogoUrl,
      twitter_handle: speaker.twitterHandle,
      linkedin_url: speaker.linkedinUrl,
      website_url: speaker.websiteUrl,
    },
    refWidth,
  };
}

async function hashFingerprint(fingerprint: unknown): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(fingerprint));
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

interface SlideSpeakerSerialised {
  id: string;
  eventId: string;
  name: string;
  title: string | null;
  company: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  talkDescriptionShort: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}

export interface RenderPair {
  eventId: string;
  slideId: string;
  speakerId: string;
}

export interface RenderedSlide {
  bytes: Uint8Array;
  mimeType: string;
  contentHash: string;
  r2Key: string;
  cached: boolean;
}

/**
 * Result variant returned by batch helpers — like {@link RenderedSlide} but
 * the `bytes` field is optional. The workflow doesn't need the bytes in
 * memory once they've been written to R2; the `r2Key` is sufficient.
 */
export interface RenderRef {
  pair: RenderPair;
  mimeType: string;
  contentHash: string;
  r2Key: string;
  cached: boolean;
}

async function readR2Object(key: string): Promise<Uint8Array | null> {
  const obj = await getObject(key);
  if (!obj) return null;
  const arr = await obj.arrayBuffer();
  return new Uint8Array(arr);
}

async function r2ObjectExists(key: string): Promise<boolean> {
  // R2 has no cheap HEAD via the binding's `get`, but `obj.body` is a stream
  // we can drop on the floor. For a small PNG this is still cheaper than
  // reading the bytes into a Uint8Array.
  const obj = await getObject(key);
  return obj !== null;
}

/**
 * Pre-render bookkeeping for one (eventId, slideId, speakerId) combo. The
 * caller fingerprints what would be rendered and decides whether a render
 * is actually needed.
 */
interface RenderTarget {
  pair: RenderPair;
  template: SlideTemplate;
  speaker: SlideSpeakerSerialised;
  refWidth: number;
  width: number;
  height: number;
  contentHash: string;
  r2Key: string;
  existing: {
    id: string;
    contentHash: string;
    r2Key: string;
    mimeType: string;
  } | null;
  /** True if we need to (re)screenshot — either no cached row, hash mismatch, or R2 object missing. */
  needsRender: boolean;
}

async function loadSpeakerInEvent(
  eventId: string,
  speakerId: string,
): Promise<SlideSpeakerSerialised> {
  const speakerRow = await getSpeakerInternal(speakerId);
  if (!speakerRow) throw new ServiceError("not_found", "Speaker not found");
  if (speakerRow.eventId !== eventId) {
    throw new ServiceError("bad_request", "Speaker does not belong to event");
  }
  return speakerRow;
}

/**
 * Build a {@link RenderTarget} for one pair, computing the would-be
 * contentHash and consulting both the DB row and the R2 object to decide
 * whether a render is actually needed.
 */
async function prepareRenderTarget(
  pair: RenderPair,
  refWidth: number,
  /** Optional cached state blob — pass to avoid re-fetching when batching pairs from the same event. */
  cachedStateData?: unknown,
): Promise<RenderTarget> {
  const db = await getPrisma();
  const { eventId, slideId, speakerId } = pair;

  const [stateData, speaker] = await Promise.all([
    cachedStateData !== undefined
      ? Promise.resolve(cachedStateData)
      : getStateInternal(`event:${eventId}`).then((s) => {
          if (!s) throw new ServiceError("not_found", "No slide state for event");
          return s.data;
        }),
    loadSpeakerInEvent(eventId, speakerId),
  ]);

  const template = pickTemplate(stateData, slideId);
  if (!template) throw new ServiceError("not_found", "Slide not found in event state");

  const fingerprint = buildVisualFingerprint(template, speaker, refWidth);
  const contentHash = await hashFingerprint(fingerprint);
  const r2Key = `slides/render/${contentHash}.png`;
  const config = ASPECT_RATIOS[template.aspect_ratio] ?? ASPECT_RATIOS["16:9"];

  const existing = await db.slideRender.findFirst({
    where: { eventId, slideId, speakerId },
    select: { id: true, contentHash: true, r2Key: true, mimeType: true },
  });

  let needsRender = true;
  if (existing && existing.contentHash === contentHash) {
    // Verify the R2 object actually still exists — covers the rare case
    // where the DB row exists but the bucket was cleared.
    needsRender = !(await r2ObjectExists(existing.r2Key));
  }

  return {
    pair,
    template,
    speaker,
    refWidth,
    width: config.width,
    height: config.height,
    contentHash,
    r2Key,
    existing,
    needsRender,
  };
}

/**
 * Take one screenshot. Reuses the provided `browser` session if given;
 * otherwise launches a one-shot session and closes it before returning.
 */
async function screenshotTarget(
  target: RenderTarget,
  browser: Browser | null,
): Promise<Uint8Array> {
  const { pair, refWidth, width, height } = target;
  const refHeight = Math.round((refWidth * height) / width);
  const deviceScaleFactor = width / refWidth;
  // Bind the signed URL to the current tenant so the selfTenanted render page
  // re-establishes THIS tenant's scope (and can't be replayed against another).
  const tenantId = await getTenantId();
  const sig = await signSlideRenderUrl({
    tenant: tenantId,
    eventId: pair.eventId,
    slideId: pair.slideId,
    speakerId: pair.speakerId,
    refWidth,
    ttlSeconds: 60,
  });
  const url =
    `${await getRenderOrigin()}/internal/slide-render/${encodeURIComponent(pair.eventId)}` +
    `/${encodeURIComponent(pair.slideId)}/${encodeURIComponent(pair.speakerId)}` +
    `?exp=${sig.exp}&sig=${sig.sig}&w=${refWidth}&t=${encodeURIComponent(tenantId)}`;

  const ownsBrowser = browser === null;
  const activeBrowser: Browser = browser ?? (await puppeteer.launch(getBrowserBinding()));
  try {
    const page = await activeBrowser.newPage();
    try {
      await page.setViewport({ width: refWidth, height: refHeight, deviceScaleFactor });
      page.on("pageerror", (err) => {
        console.error("[slide-render][page] error:", err.message);
      });

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: RENDER_TIMEOUT_MS,
      });
      const status = response?.status() ?? 0;
      if (status >= 400) {
        const body = await page.content().catch(() => "(no body)");
        throw new ServiceError(
          "internal",
          `Render page returned HTTP ${status} — body excerpt: ${body.slice(0, 200)}`,
        );
      }

      try {
        await page.waitForSelector(READY_SELECTOR, { timeout: RENDER_TIMEOUT_MS });
      } catch (err) {
        const snapshot = await page.content().catch(() => "(no body)");
        console.error(
          `[slide-render] readiness wait failed — head of HTML: ${snapshot.slice(0, 800)}`,
        );
        throw err;
      }

      const element = await page.$(SLIDE_SELECTOR);
      if (!element) {
        throw new ServiceError("internal", "Render page produced no #slide-root element");
      }
      const png = await element.screenshot({ type: "png", omitBackground: false });
      return png instanceof Uint8Array ? png : new Uint8Array(png as unknown as ArrayBuffer);
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    if (ownsBrowser) {
      await activeBrowser.close().catch(() => {});
    }
  }
}

async function isR2KeyStillReferenced(r2Key: string, excludeRowId?: string): Promise<boolean> {
  const db = await getPrisma();
  const other = await db.slideRender.findFirst({
    where: excludeRowId ? { r2Key, NOT: { id: excludeRowId } } : { r2Key },
    select: { id: true },
  });
  return other !== null;
}

/**
 * Persist a freshly-rendered PNG to R2 + upsert the `SlideRender` row.
 * If the row already pointed at a different r2Key that nothing else
 * references, drop the orphaned object.
 */
async function commitRender(target: RenderTarget, png: Uint8Array): Promise<void> {
  const db = await getPrisma();
  await putBytesAtKey(target.r2Key, png, "image/png");

  if (target.existing) {
    if (
      target.existing.r2Key !== target.r2Key &&
      !(await isR2KeyStillReferenced(target.existing.r2Key, target.existing.id))
    ) {
      await deleteObject(target.existing.r2Key);
    }
    await db.slideRender.update({
      where: { id: target.existing.id },
      data: {
        contentHash: target.contentHash,
        r2Key: target.r2Key,
        mimeType: "image/png",
        sizeBytes: png.byteLength,
      },
    });
  } else {
    await db.slideRender.create({
      data: {
        eventId: target.pair.eventId,
        slideId: target.pair.slideId,
        speakerId: target.pair.speakerId,
        contentHash: target.contentHash,
        r2Key: target.r2Key,
        mimeType: "image/png",
        sizeBytes: png.byteLength,
      },
    });
  }
}

/**
 * Render (or fetch from cache) the PNG for one (eventId, slideId, speakerId)
 * combo. Returns the bytes along with cache metadata.
 *
 * This is the single-slide entrypoint used by the admin preview route. For
 * batch exports (the SlideExportWorkflow) use {@link renderManyInOneSession}
 * instead so all pairs share one browser session.
 */
export async function renderSlidePng(args: {
  eventId: string;
  slideId: string;
  speakerId: string;
  refWidth?: number;
}): Promise<RenderedSlide> {
  const { eventId, slideId, speakerId } = args;
  const refWidth = args.refWidth ?? DEFAULT_RENDER_REF_WIDTH;
  const target = await prepareRenderTarget({ eventId, slideId, speakerId }, refWidth);

  if (!target.needsRender && target.existing) {
    const cached = await readR2Object(target.existing.r2Key);
    if (cached) {
      return {
        bytes: cached,
        mimeType: target.existing.mimeType,
        contentHash: target.contentHash,
        r2Key: target.existing.r2Key,
        cached: true,
      };
    }
    // Cache row exists but R2 object is gone — fall through to a real render.
  }

  const png = await screenshotTarget(target, null);
  await commitRender(target, png);
  return {
    bytes: png,
    mimeType: "image/png",
    contentHash: target.contentHash,
    r2Key: target.r2Key,
    cached: false,
  };
}

/**
 * Render one (slide, speaker) pair for the export workflow. Returns the R2
 * key + cache flag without holding bytes in memory — the caller (the
 * workflow's package step) reads from R2 directly.
 *
 * Each call opens its own browser session, so the per-pair-step workflow
 * pays for N session launches across a batch. Trade-off accepted vs. the
 * old single-session batch step which couldn't recover from a mid-batch
 * `WorkflowInternalError` without restarting from pair 0.
 */
export async function renderPairForExport(args: {
  pair: RenderPair;
  refWidth?: number;
  force?: boolean;
}): Promise<RenderRef> {
  const refWidth = args.refWidth ?? DEFAULT_RENDER_REF_WIDTH;
  const target = await prepareRenderTarget(args.pair, refWidth);

  if (!args.force && !target.needsRender && target.existing) {
    return {
      pair: args.pair,
      mimeType: target.existing.mimeType,
      contentHash: target.contentHash,
      r2Key: target.existing.r2Key,
      cached: true,
    };
  }

  const png = await screenshotTarget(target, null);
  await commitRender(target, png);
  return {
    pair: args.pair,
    mimeType: "image/png",
    contentHash: target.contentHash,
    r2Key: target.r2Key,
    cached: false,
  };
}

/**
 * Cache-only lookup. Used by the export POST route to short-circuit when a
 * single-pair request is fully cached — no browser, no DB write, no R2 read
 * of the bytes themselves (just a HEAD-equivalent presence check).
 */
export async function getCachedRenderIfFresh(args: {
  eventId: string;
  slideId: string;
  speakerId: string;
  refWidth?: number;
}): Promise<{ r2Key: string; url: string; mimeType: string; contentHash: string } | null> {
  const refWidth = args.refWidth ?? DEFAULT_RENDER_REF_WIDTH;
  try {
    const target = await prepareRenderTarget(
      { eventId: args.eventId, slideId: args.slideId, speakerId: args.speakerId },
      refWidth,
    );
    if (target.needsRender || !target.existing) return null;
    return {
      r2Key: target.existing.r2Key,
      url: publicUrl(target.existing.r2Key),
      mimeType: target.existing.mimeType,
      contentHash: target.contentHash,
    };
  } catch (err) {
    // Lookups should never throw — short-circuit just declines the
    // optimisation, the caller falls through to the normal workflow path.
    console.warn("[slide-export] cache lookup failed, skipping short-circuit:", err);
    return null;
  }
}
