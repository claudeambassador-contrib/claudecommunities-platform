import { rateLimit } from "@/lib/rate-limit";
import { isStorageConfigured } from "@/lib/storage";
import { ServiceError } from "./_errors";

export {
  getObject,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  putDataUrl,
  putFile,
  StorageError,
} from "@/lib/storage";

/**
 * Shared gating for every upload endpoint (per CLAUDE.md): in-process rate
 * limit + storage-configured 503 preflight. Throws ServiceError so the route
 * adapter's withService maps to the right HTTP response.
 */
export function assertUploadAllowed(req: Request): void {
  const limited = rateLimit(req, { key: "upload", limit: 20, windowMs: 60_000 });
  if (limited) {
    throw new ServiceError("rate_limited", "Too many requests");
  }
  if (!isStorageConfigured()) {
    throw new ServiceError("unavailable", "File upload service not configured");
  }
}
