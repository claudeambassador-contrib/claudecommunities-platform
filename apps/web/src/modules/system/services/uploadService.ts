import type { ImageUploadPorts } from "@/modules/system/types";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
// Note: @/shared/storage/r2 is imported dynamically below (not at module top).
// It transitively pulls in @/shared/db/env, which statically imports
// `cloudflare:workers` — fine at runtime (Workers/wrangler), but a static
// import here would make every consumer of this module (e.g. mcpService,
// which lists this as an MCP tool) fail to load outside that runtime, such
// as under vitest. Deferring the import keeps buildUploadKey/sanitizeFilename
// pure and side-effect-free, and keeps this module safely importable from
// contexts (like tests) that never call storeUpload.

export interface ImageUploadCredentials {
  curlCommand: string;
  note: string;
  uploadUrl: string;
}

const DEFAULT_FOLDER = "community/posts";
const NOTE =
  'Replace FILE_PATH with the actual local path to your image. The response will contain a "url" field — pass that as imageUrl to createPost or updatePost.';
const TRAILING_SLASH = /\/$/;

export function requestImageUploadUrl(
  ports: ImageUploadPorts,
  input: { folder?: string } = {},
): Result<ImageUploadCredentials> {
  const baseUrl = ports.baseUrl.replace(TRAILING_SLASH, "");
  if (!baseUrl) {
    return err("unavailable", 503, "Upload base URL is not configured");
  }
  if (!ports.token) {
    return err("unauthenticated", 401, "No auth token available");
  }
  const folder = input.folder?.trim() || DEFAULT_FOLDER;
  const uploadUrl = `${baseUrl}/api/upload/mcp`;
  const curlCommand = [
    `curl -s -X POST "${uploadUrl}"`,
    `-H "Authorization: Bearer ${ports.token}"`,
    `-F "file=@FILE_PATH;type=image/jpeg"`,
    `-F "folder=${folder}"`,
  ].join(" \\\n  ");
  return ok({ curlCommand, note: NOTE, uploadUrl });
}

const FOLDER_RE = /^[a-z0-9][a-z0-9/_-]{0,63}$/i;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replaceAll(/[/\\]+/g, "-")
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/^[.-]+|[-.]+$/g, "")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/-+\./g, ".");
  return cleaned || "file";
}

const LEADING_TRAILING_SLASHES = /^\/+|\/+$/g;
const TRAILING_SLASHES = /\/+$/;

/**
 * Mirrors `tenantObjectKey` from @/shared/storage/r2 (deliberately duplicated
 * here — see the note at the top of this file for why: `buildUploadKey` must
 * stay synchronous and free of any static dependency on the Workers runtime).
 */
function joinTenantKey(r2Prefix: string, ...parts: string[]): string {
  const cleaned = parts.map((p) => p.replace(LEADING_TRAILING_SLASHES, "")).filter(Boolean);
  return `${r2Prefix.replace(TRAILING_SLASHES, "")}/${cleaned.join("/")}`;
}

export function buildUploadKey(opts: {
  folder: string;
  filename: string;
  r2Prefix?: string | null;
}): Result<{ key: string }> {
  if (!FOLDER_RE.test(opts.folder) || opts.folder.includes("..")) {
    return err("invalid_folder", 400);
  }
  const name = `${crypto.randomUUID()}-${sanitizeFilename(opts.filename)}`;
  const key = opts.r2Prefix
    ? joinTenantKey(opts.r2Prefix, opts.folder, name)
    : `${opts.folder}/${name}`;
  return ok({ key });
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
]);

/** The one upload implementation. Routes are thin adapters over this. */
export async function storeUpload(
  form: FormData,
  opts: { r2Prefix?: string | null } = {},
): Promise<Result<{ key: string; url: string }>> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return err("file_required", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return err("file_too_large", 413);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return err("unsupported_type", 415);
  }
  const folder = String(form.get("folder") ?? "uploads");
  const built = buildUploadKey({ filename: file.name, folder, r2Prefix: opts.r2Prefix });
  if (!built.ok) {
    return built;
  }
  const { publicUrl, putBytes, StorageError } = await import("@/shared/storage/r2");
  try {
    await putBytes(built.key, await file.arrayBuffer(), file.type || "application/octet-stream");
  } catch (error) {
    if (error instanceof StorageError) {
      return err("storage_unavailable", error.status);
    }
    throw error;
  }
  return ok({ key: built.key, url: publicUrl(built.key) });
}
