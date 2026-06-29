/**
 * GET /api/admin/slide-export/[jobId]
 *
 * Poll endpoint for a SlideExportJob. The heavy lifting (DB read +
 * conditional workflow-instance probe + URL derivation) lives in
 * `src/lib/services/slideExport.ts` so route logic stays a thin adapter.
 */
import { requireSessionUser } from "@/lib/services/_auth";
import { isServiceError, ServiceError } from "@/lib/services/_errors";
import { getSlideExportJobStatus } from "@/lib/services/slideExport";

export async function GET(_request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  try {
    if (!jobId) throw new ServiceError("bad_request", "Missing jobId");
    const user = await requireSessionUser();
    const status = await getSlideExportJobStatus(jobId, user);
    return Response.json(status);
  } catch (err) {
    if (isServiceError(err)) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[slide-export][status] uncaught:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
