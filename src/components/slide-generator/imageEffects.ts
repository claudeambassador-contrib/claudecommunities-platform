/**
 * Image effects for speaker headshots.
 *
 * Background removal uses `@imgly/background-removal` (browser-side, ~40 MB
 * model downloaded on first call and cached by the library). We dynamic-import
 * it so the model code never enters the SSR bundle.
 */

const HEADSHOT_FOLDER = "speaker-headshots";

export interface ProcessedImage {
  /** Uploaded R2 URL of the processed image. */
  url: string;
  /** File handed to the uploader (kept so callers can preview locally if needed). */
  file: File;
}

async function blobToPngFile(blob: Blob, baseName = "speaker"): Promise<File> {
  return new File([blob], `${baseName}-${Date.now()}.png`, { type: "image/png" });
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  return res.blob();
}

/**
 * Remove the background from an image URL and upload the resulting PNG.
 * First call downloads the ~40 MB model — show a loading hint in the UI.
 */
export async function removeBackgroundAndUpload(
  sourceUrl: string,
  uploadFile: (file: File, opts: { folder: string }) => Promise<{ url: string }>,
): Promise<ProcessedImage> {
  const { removeBackground } = await import("@imgly/background-removal");
  const sourceBlob = await fetchAsBlob(sourceUrl);
  const cutoutBlob = await removeBackground(sourceBlob);
  const file = await blobToPngFile(cutoutBlob, "headshot-bg-removed");
  const { url } = await uploadFile(file, { folder: HEADSHOT_FOLDER });
  return { url, file };
}

/**
 * Apply a greyscale filter to an image URL and upload the result.
 * Pure canvas operation — no heavy dependency.
 */
export async function greyscaleAndUpload(
  sourceUrl: string,
  uploadFile: (file: File, opts: { folder: string }) => Promise<{ url: string }>,
): Promise<ProcessedImage> {
  const blob = await fetchAsBlob(sourceUrl);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 709 luma coefficients
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
  ctx.putImageData(img, 0, 0);
  const outBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!outBlob) throw new Error("Greyscale conversion failed");
  const file = await blobToPngFile(outBlob, "headshot-grey");
  const { url } = await uploadFile(file, { folder: HEADSHOT_FOLDER });
  return { url, file };
}
