/**
 * Internal admin route that returns a PNG for one (eventId, slideId, speakerId)
 * combo. Used by the standalone slide editor's "Download / Export" buttons so
 * the editor and the MCP iframe both render through the same cached
 * server-side pipeline.
 *
 * Returns:
 *  - 200 image/png on success
 *  - 503 when the BROWSER binding isn't configured (e.g. local dev); the
 *    editor's UI falls back to the legacy client-side html-to-image path.
 *  - 401/403 for unauthorized callers
 *  - 404 for missing event/slide/speaker
 */
import { rateLimit } from "@/lib/rate-limit";
import { ensurePermission, requireSessionUser } from "@/lib/services/_auth";
import { isServiceError, ServiceError } from "@/lib/services/_errors";
import { DEFAULT_RENDER_REF_WIDTH, renderSlidePng } from "@/lib/services/slideRender";

function parseRefWidth(raw: string | null): number {
  if (!raw) return DEFAULT_RENDER_REF_WIDTH;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_RENDER_REF_WIDTH;
  // Clamp to a sensible band. <320 produces sub-readable previews; >2000
  // makes deviceScaleFactor < 1 and burns memory in the headless browser.
  return Math.max(320, Math.min(2000, Math.round(n)));
}

export async function GET(request: Request) {
  const limited = rateLimit(request, { key: "slide-render", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const user = await requireSessionUser();
    ensurePermission(user, "tools.use");

    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId");
    const slideId = url.searchParams.get("slideId");
    const speakerId = url.searchParams.get("speakerId");
    if (!eventId || !slideId || !speakerId) {
      throw new ServiceError("bad_request", "eventId, slideId, speakerId are required");
    }
    // Optional caller-supplied reference width. The text in `SlidePreview`
    // is in absolute px (`clamp(min, vw, max)` with `max` always winning at
    // realistic viewports), so rendering at the same container width the
    // editor uses keeps text proportions identical between editor preview,
    // editor download, and MCP iframe.
    const refWidth = parseRefWidth(url.searchParams.get("refWidth"));

    const result = await renderSlidePng({ eventId, slideId, speakerId, refWidth });
    // Copy into a fresh ArrayBuffer — the underlying buffer may be a
    // SharedArrayBuffer slice (depending on the puppeteer return) which
    // some TS lib targets refuse to type as BodyInit.
    const body = new Uint8Array(result.bytes).buffer as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": result.mimeType,
        // Cached by content hash on R2; the response is safe to cache at the
        // edge for a short window since the URL doesn't change when content
        // is stable.
        "cache-control": "private, max-age=60",
        "x-slide-cache": result.cached ? "hit" : "miss",
      },
    });
  } catch (err) {
    if (isServiceError(err)) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[slide-render] uncaught error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
