/**
 * Client-side upload service.
 *
 * One entry point for all browser-initiated file uploads. Calls POST /api/upload,
 * which writes to R2 via src/lib/storage.ts.
 *
 * Use XHR (not fetch) so we can report upload progress.
 */

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  resourceType: "image" | "video" | "raw";
  bytes: number;
}

export interface UploadOptions {
  /** Folder/prefix inside the bucket, e.g. "community/posts" */
  folder?: string;
  /** Called with 0–100 as bytes are uploaded. */
  onProgress?: (percent: number) => void;
}

export class UploadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

/**
 * Downscale an image File so its longest edge is at most `maxEdge` pixels.
 * Preserves aspect ratio. Returns the original File unchanged if it's already
 * within bounds, not an image, or if the browser can't decode it. Output
 * format matches the input MIME type (JPEG/PNG/WebP); other types pass through.
 */
export async function resizeImage(file: File, maxEdge: number, quality = 0.9): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const outputType = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ? file.type
    : "image/jpeg";

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge <= maxEdge) {
    bitmap.close();
    return file;
  }
  const scale = maxEdge / longEdge;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outputType, quality),
  );
  if (!blob) return file;
  const ext = outputType.split("/")[1];
  const newName = `${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
  return new File([blob], newName, { type: outputType, lastModified: Date.now() });
}

export function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", options.folder ?? "community");

    const xhr = new XMLHttpRequest();

    if (options.onProgress) {
      const cb = options.onProgress;
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          cb(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as UploadResult;
          resolve(result);
        } catch {
          reject(new UploadError("Invalid server response", xhr.status));
        }
        return;
      }
      let msg = `Upload failed (${xhr.status})`;
      try {
        const err = JSON.parse(xhr.responseText) as { error?: string };
        if (err.error) msg = err.error;
      } catch {
        /* keep default */
      }
      reject(new UploadError(msg, xhr.status));
    });

    xhr.addEventListener("error", () => reject(new UploadError("Upload failed", 0)));
    xhr.addEventListener("abort", () => reject(new UploadError("Upload cancelled", 0)));

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}
