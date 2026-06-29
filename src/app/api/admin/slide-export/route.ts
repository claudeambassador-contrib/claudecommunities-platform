/**
 * POST /api/admin/slide-export
 *
 * Kicks off a batch slide-export job (or short-circuits on a cache hit).
 *
 * Request body:
 *   {
 *     eventId: string,
 *     slideIds: string[],          // non-empty
 *     speakerIds: string[],        // non-empty
 *     filenameBase: string,        // prefix for download / zip entries
 *     refWidth?: number,           // optional; defaults to DEFAULT_RENDER_REF_WIDTH
 *     force?: boolean              // when true, bypass content-hash cache
 *   }
 *
 * Response shapes:
 *   - 200 with `{ jobId: null, output: { kind: 'png', url, filename } }` —
 *     the request resolved to one cached pair; no workflow was started.
 *   - 200 with `{ jobId: string }` — a new SlideExportJob was created.
 *     Poll `GET /api/admin/slide-export/<jobId>` for progress.
 *   - 4xx/5xx via the standard ServiceError → JSON mapping.
 *
 * Admin-only; rate-limited.
 */
import { rateLimit } from "@/lib/rate-limit";
import { ensurePermission, requireSessionUser } from "@/lib/services/_auth";
import { isServiceError, ServiceError } from "@/lib/services/_errors";
import { startSlideExportJob, tryShortCircuitCachedExport } from "@/lib/services/slideExport";

interface PostBody {
  eventId?: unknown;
  slideIds?: unknown;
  speakerIds?: unknown;
  filenameBase?: unknown;
  refWidth?: unknown;
  force?: unknown;
  disambiguateFilenames?: unknown;
}

function asNonEmptyStringArray(raw: unknown, field: string): string[] {
  if (!Array.isArray(raw)) {
    throw new ServiceError("bad_request", `${field} must be an array`);
  }
  if (raw.length === 0) {
    throw new ServiceError("bad_request", `${field} must not be empty`);
  }
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || v.length === 0) {
      throw new ServiceError("bad_request", `${field} entries must be non-empty strings`);
    }
    out.push(v);
  }
  return out;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "slide-export", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const user = await requireSessionUser();
    ensurePermission(user, "tools.use");

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const eventId = typeof body.eventId === "string" ? body.eventId : null;
    if (!eventId) throw new ServiceError("bad_request", "eventId is required");
    const slideIds = asNonEmptyStringArray(body.slideIds, "slideIds");
    const speakerIds = asNonEmptyStringArray(body.speakerIds, "speakerIds");
    const filenameBase =
      typeof body.filenameBase === "string" && body.filenameBase.length > 0
        ? body.filenameBase
        : "slides";
    const refWidth = typeof body.refWidth === "number" ? body.refWidth : undefined;
    const force = body.force === true;
    const disambiguateFilenames = body.disambiguateFilenames === true;

    const input = {
      eventId,
      slideIds,
      speakerIds,
      filenameBase,
      refWidth,
      force,
      disambiguateFilenames,
    };

    const cached = await tryShortCircuitCachedExport(input);
    if (cached) {
      return Response.json({ jobId: null, output: cached });
    }

    const { jobId } = await startSlideExportJob(input, user);
    return Response.json({ jobId });
  } catch (err) {
    if (isServiceError(err)) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[slide-export] uncaught error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
