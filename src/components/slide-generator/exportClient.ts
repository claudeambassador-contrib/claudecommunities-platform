/**
 * Browser-side client for the `/api/admin/slide-export` workflow pipeline.
 *
 * Three pieces:
 *  - {@link startExport} POSTs the job request. Returns either a
 *    `short-circuit` result (cache hit on a single-pair export — download
 *    immediately) or a `job` with a `jobId` to poll.
 *  - {@link pollExportJob} polls the status endpoint until a terminal state
 *    and invokes `onProgress` on every tick.
 *  - {@link triggerDownload} drives the actual download via a same-origin
 *    `<a download>` click — preserves the suggested filename instead of
 *    inheriting the R2 object's hash-based name.
 *
 * `runExport` glues these together for the common path.
 */

export interface ExportJobOutput {
  kind: "png" | "zip";
  url: string;
  filename: string;
}

export interface ExportProgress {
  status: "queued" | "running" | "complete" | "errored";
  completedCount: number;
  totalCount: number;
  /** True when `completedCount` hasn't advanced in {@link SLOW_THRESHOLD_MS}.
   *  The UI uses this to show a "taking longer than usual" warning + a
   *  Stop-waiting affordance so the user isn't trapped in the modal while
   *  the workflow churns through a long retry. */
  slow: boolean;
}

/** How long the workflow can sit on the same `completedCount` before the
 *  client surfaces a "this is unusually slow" state. Tuned to be longer
 *  than a typical single-pair render (5–20 s) but shorter than Cloudflare's
 *  5-minute internal-error retry window. */
const SLOW_THRESHOLD_MS = 60_000;

export interface StartExportRequest {
  eventId: string;
  slideIds: string[];
  speakerIds: string[];
  filenameBase: string;
  refWidth?: number;
  force?: boolean;
  /** Tell the server to include the slide label in single-pair filenames
   *  too, so separate per-slide exports for the same speaker don't collide
   *  on disk. Caller passes `true` when the editor has multiple slide types. */
  disambiguateFilenames?: boolean;
}

export type StartExportResult =
  | { kind: "short-circuit"; output: ExportJobOutput }
  | { kind: "job"; jobId: string; totalCount: number };

/**
 * POST to `/api/admin/slide-export`. Resolves the cache-hit short-circuit
 * or returns a jobId to poll.
 */
export async function startExport(req: StartExportRequest): Promise<StartExportResult> {
  const res = await fetch("/api/admin/slide-export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(`Slide export start failed: ${message}`);
  }
  const body = (await res.json()) as {
    jobId: string | null;
    output?: { kind: "png" | "zip"; url: string; filename: string };
  };
  if (body.jobId === null && body.output) {
    return { kind: "short-circuit", output: body.output };
  }
  if (body.jobId) {
    // Snap total to the request shape so the initial progress UI doesn't
    // flash 0/0 before the first poll lands.
    const totalCount = req.slideIds.length * req.speakerIds.length;
    return { kind: "job", jobId: body.jobId, totalCount };
  }
  throw new Error("Slide export start returned an unexpected response shape");
}

interface PollResponse {
  jobId: string;
  status: "queued" | "running" | "complete" | "errored";
  totalCount: number;
  completedCount: number;
  outputKind?: "png" | "zip";
  outputUrl?: string;
  downloadFilename?: string;
  errorMessage?: string;
}

/**
 * Fetch a single poll response. Re-throws `AbortError` verbatim so callers can
 * distinguish a user cancel from a real failure.
 */
async function fetchPollBody(jobId: string, abortSignal?: AbortSignal): Promise<PollResponse> {
  const res = await fetch(`/api/admin/slide-export/${encodeURIComponent(jobId)}`, {
    cache: "no-store",
    signal: abortSignal,
  });
  if (!res.ok) {
    throw new Error(`status ${res.status}`);
  }
  return (await res.json()) as PollResponse;
}

/**
 * Resolve a terminal poll response. Returns the job output on `complete`,
 * throws on `errored`, and returns `null` for non-terminal states (keep polling).
 */
function resolveTerminalState(body: PollResponse): ExportJobOutput | null {
  if (body.status === "errored") {
    throw new Error(body.errorMessage ?? "Slide export failed");
  }
  if (body.status === "complete") {
    if (!body.outputUrl || !body.outputKind) {
      throw new Error("Slide export complete but output is missing");
    }
    return {
      kind: body.outputKind,
      url: body.outputUrl,
      filename: body.downloadFilename ?? `export.${body.outputKind}`,
    };
  }
  return null;
}

/**
 * Poll the status endpoint until a terminal state. `onProgress` is invoked
 * on every successful poll. Throws if the job ends in `errored` or if
 * polling itself fails too many times in a row.
 */
export async function pollExportJob(
  jobId: string,
  opts: {
    onProgress?: (p: ExportProgress) => void;
    intervalMs?: number;
    abortSignal?: AbortSignal;
  } = {},
): Promise<ExportJobOutput> {
  const interval = opts.intervalMs ?? 1500;
  let consecutiveErrors = 0;
  // Cap consecutive transport errors so a dropped network doesn't loop
  // forever silently; surface as a real failure.
  const MAX_CONSECUTIVE_ERRORS = 5;

  let lastCompletedCount = -1;
  let lastProgressAt = Date.now();

  // Loop until terminal. AbortSignal short-circuits the wait so closing the
  // dialog can stop polling immediately.
  while (true) {
    if (opts.abortSignal?.aborted) {
      throw new DOMException("Polling cancelled", "AbortError");
    }

    let body: PollResponse;
    try {
      body = await fetchPollBody(jobId, opts.abortSignal);
      consecutiveErrors = 0;
    } catch (err) {
      // fetch() raises AbortError when the signal is aborted — re-throw
      // verbatim so callers can distinguish a user cancel from a real
      // network/server failure.
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `Slide export polling failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await sleep(interval);
      continue;
    }

    if (body.completedCount !== lastCompletedCount) {
      lastCompletedCount = body.completedCount;
      lastProgressAt = Date.now();
    }
    const slow = Date.now() - lastProgressAt > SLOW_THRESHOLD_MS;

    if (opts.onProgress) {
      opts.onProgress({
        status: body.status,
        completedCount: body.completedCount,
        totalCount: body.totalCount,
        slow,
      });
    }

    const terminal = resolveTerminalState(body);
    if (terminal) {
      return terminal;
    }

    await sleep(interval);
  }
}

/**
 * Same-origin download via an in-DOM anchor click. Works for `/api/files/*`
 * URLs (which serve R2 objects). The `download` attribute only honors the
 * filename when the resource is same-origin, which our /api/files route is.
 */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Convenience helper: start + poll + download. */
export async function runExport(
  req: StartExportRequest,
  opts: {
    onProgress?: (p: ExportProgress) => void;
    abortSignal?: AbortSignal;
  } = {},
): Promise<ExportJobOutput> {
  const started = await startExport(req);
  if (started.kind === "short-circuit") {
    // Surface a synthetic "complete" tick so the UI doesn't show 0/1.
    if (opts.onProgress) {
      opts.onProgress({ status: "complete", completedCount: 1, totalCount: 1, slow: false });
    }
    triggerDownload(started.output.url, started.output.filename);
    return started.output;
  }
  // Seed the UI with the known total before the first poll completes.
  if (opts.onProgress) {
    opts.onProgress({
      status: "queued",
      completedCount: 0,
      totalCount: started.totalCount,
      slow: false,
    });
  }
  const output = await pollExportJob(started.jobId, opts);
  triggerDownload(output.url, output.filename);
  return output;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
