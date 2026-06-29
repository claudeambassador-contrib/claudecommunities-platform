/**
 * Storage service — single entry point for all R2 object storage.
 *
 * API endpoints must not call the R2 binding directly; they go through here.
 * Backed by the `STORAGE` R2 binding declared in wrangler.jsonc.
 *
 * Public objects are served via `/api/files/<key>` (see api/files/[...key]/route.ts),
 * so URLs returned from `put*` are always relative.
 */

import { getEnv } from "@/lib/cf-env";

// ---------- Allow-lists and limits (shared defaults) ----------

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
] as const;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
] as const;

export const DEFAULT_ALLOWED_MIME_TYPES: readonly string[] = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// SVG is intentionally excluded everywhere: it can carry <script> (stored XSS).

const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
};

function extFromMime(mime: string, filename?: string): string {
  if (EXT_FROM_MIME[mime]) return EXT_FROM_MIME[mime];
  const m = filename?.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "bin";
}

function resourceTypeFor(mime: string): "image" | "video" | "raw" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "raw";
}

function maxSizeFor(mime: string): number {
  if (mime.startsWith("image/")) return MAX_IMAGE_SIZE;
  if (mime.startsWith("video/")) return MAX_VIDEO_SIZE;
  return MAX_FILE_SIZE;
}

// ---------- Types ----------

export interface PutOptions {
  /** Folder prefix inside the bucket, e.g. "community/posts". Defaults to "community". */
  folder?: string;
  /** Original filename — used to derive the extension when MIME maps to "bin". */
  filename?: string;
  /** Restrict to specific MIME types. Defaults to {@link DEFAULT_ALLOWED_MIME_TYPES}. */
  allowedMimeTypes?: readonly string[];
  /** Maximum byte size. Defaults to a per-resource-type limit. */
  maxBytes?: number;
}

export interface PutResult {
  /** R2 object key (e.g. "community/posts/abc.jpg"). Stored as `publicId`. */
  key: string;
  /** Public URL — relative path served by /api/files. */
  url: string;
  /** File extension (no leading dot). */
  format: string;
  /** Coarse type derived from MIME. */
  resourceType: "image" | "video" | "raw";
  /** Object size in bytes. */
  bytes: number;
  /** MIME type the object was stored with. */
  contentType: string;
}

export class StorageError extends Error {
  /** HTTP status hint for API handlers. */
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

// ---------- Binding ----------

function getBucket(): R2Bucket {
  const env = getEnv();
  const bucket = (env as unknown as { STORAGE?: R2Bucket }).STORAGE;
  if (!bucket) {
    throw new StorageError("Storage is not configured (missing STORAGE binding)", 503);
  }
  return bucket;
}

export function isStorageConfigured(): boolean {
  try {
    const env = getEnv();
    return Boolean((env as unknown as { STORAGE?: R2Bucket }).STORAGE);
  } catch {
    return false;
  }
}

// ---------- Internal ----------

function normalizeFolder(folder: string | undefined): string {
  return (folder || "community").replace(/^\/+|\/+$/g, "");
}

function checkType(contentType: string, allowed: readonly string[] | undefined): void {
  const list = allowed ?? DEFAULT_ALLOWED_MIME_TYPES;
  if (contentType === "image/svg+xml") {
    throw new StorageError("SVG uploads are not allowed", 400);
  }
  if (!list.includes(contentType)) {
    throw new StorageError(`File type not allowed: ${contentType}`, 400);
  }
}

function checkSize(bytes: number, contentType: string, maxBytes: number | undefined): void {
  const limit = maxBytes ?? maxSizeFor(contentType);
  if (bytes > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    throw new StorageError(`File too large. Maximum size is ${mb}MB`, 400);
  }
}

async function putRaw(
  body: ArrayBuffer | Uint8Array | ReadableStream | Blob,
  contentType: string,
  bytes: number,
  options: PutOptions,
): Promise<PutResult> {
  checkType(contentType, options.allowedMimeTypes);
  checkSize(bytes, contentType, options.maxBytes);

  const folder = normalizeFolder(options.folder);
  const ext = extFromMime(contentType, options.filename);
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await getBucket().put(key, body as Parameters<R2Bucket["put"]>[1], {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return {
    key,
    url: publicUrl(key),
    format: ext,
    resourceType: resourceTypeFor(contentType),
    bytes,
    contentType,
  };
}

// ---------- Public API ----------

/** Upload a multipart `File` (browser FormData). */
export async function putFile(file: File, options: PutOptions = {}): Promise<PutResult> {
  return putRaw(file, file.type, file.size, {
    filename: file.name,
    ...options,
  });
}

/** Upload from a base64 `data:` URL. */
export async function putDataUrl(dataUrl: string, options: PutOptions = {}): Promise<PutResult> {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new StorageError("Expected a base64 data URL", 400);
  }
  const match = dataUrl.match(/^data:([^;,]+)(?:;base64)?,([\s\S]*)$/);
  if (!match) {
    throw new StorageError("Invalid data URL", 400);
  }
  const contentType = match[1].toLowerCase();
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  return putRaw(bytes, contentType, bytes.byteLength, options);
}

/** Upload raw bytes. */
export async function putBytes(
  bytes: ArrayBuffer | Uint8Array | Buffer,
  contentType: string,
  options: PutOptions = {},
): Promise<PutResult> {
  const view =
    bytes instanceof Uint8Array
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new Uint8Array(bytes as ArrayBuffer);
  return putRaw(view, contentType, view.byteLength, options);
}

/**
 * Write bytes to R2 at a caller-chosen key (skips the random-UUID path used
 * by {@link putBytes}). Use for content-addressed caches like the slide
 * render service where the key must be derivable from the content hash.
 *
 * Skips the allowed-mime-types and size-cap policies — callers are trusted
 * services (not user uploads) and the policies don't fit the use case.
 */
export async function putBytesAtKey(
  key: string,
  bytes: ArrayBuffer | Uint8Array | Buffer,
  contentType: string,
  cacheControl: string = "public, max-age=31536000, immutable",
): Promise<{ key: string; url: string; bytes: number }> {
  const view =
    bytes instanceof Uint8Array
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new Uint8Array(bytes as ArrayBuffer);
  await getBucket().put(key, view, {
    httpMetadata: { contentType, cacheControl },
  });
  return { key, url: publicUrl(key), bytes: view.byteLength };
}

/**
 * Fetch a remote URL and upload its body. Content type comes from the response
 * header, falling back to `fallbackContentType` (default `image/jpeg`).
 */
export async function putFromUrl(
  url: string,
  options: PutOptions & { fallbackContentType?: string } = {},
): Promise<PutResult> {
  const { fallbackContentType = "image/jpeg", ...putOptions } = options;
  const res = await fetch(url);
  if (!res.ok) {
    throw new StorageError(`Failed to fetch ${url} (${res.status})`, 400);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || fallbackContentType;
  return putBytes(bytes, contentType, putOptions);
}

/** Fetch an object by key. Returns `null` if it doesn't exist. */
export async function getObject(key: string): Promise<R2ObjectBody | null> {
  return getBucket().get(key);
}

/** Delete an object by key. Returns `true` on success or if absent. */
export async function deleteObject(key: string): Promise<boolean> {
  try {
    await getBucket().delete(key);
    return true;
  } catch (err) {
    console.error("Failed to delete from R2:", err);
    return false;
  }
}

/** Public URL for a stored object key. Served via the /api/files route. */
export function publicUrl(key: string): string {
  return `/api/files/${key}`;
}

/**
 * Returns true if `url` is a reference to an object served by this storage
 * service. Accepts the relative `/api/files/<key>` form produced by `publicUrl`,
 * and the legacy absolute forms (R2 public host, `*.r2.dev`) from data that
 * predates the /api/files migration.
 */
export function isStorageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.pathname.startsWith("/api/files/")) return true;
    if (u.hostname.endsWith(".r2.dev")) return true;
    const publicHost = (() => {
      try {
        return new URL(process.env.R2_PUBLIC_URL || "").hostname || null;
      } catch {
        return null;
      }
    })();
    if (publicHost && u.hostname === publicHost) return true;
    return false;
  } catch {
    return false;
  }
}
