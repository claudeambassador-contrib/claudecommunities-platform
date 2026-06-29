import { toPng } from "html-to-image";
import JSZip from "jszip";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import SlidePreview from "./SlidePreview";
import { ASPECT_RATIOS, type SlideSpeaker, type SlideTemplate } from "./types";

/**
 * Fallback reference width when the caller can't measure the live preview.
 * The captured node's font sizes are `clamp(min, X*vw, max)`-based — at any
 * reasonable viewport the `max` value wins, so this width drives only the
 * source resolution. `pixelRatio` then scales it up to the target slide width,
 * preserving the proportions the user sees in the live preview.
 */
const DEFAULT_REFERENCE_WIDTH = 800;

/**
 * Render a single slide off-screen and capture it as a PNG data URL. Uses the
 * same SlidePreview path the user edits in the UI (no separate export-mode
 * render), so the result matches what they see in the preview pane.
 *
 * Pass `referenceWidth` as the live preview's `clientWidth` so the offscreen
 * render uses an identical width — the font/proportion that looks right in
 * the preview maps 1:1 to the upscaled output canvas.
 */
export async function renderSlideToDataURL(
  template: SlideTemplate,
  speaker: SlideSpeaker,
  referenceWidth?: number,
): Promise<string> {
  const config = ASPECT_RATIOS[template.aspect_ratio] ?? ASPECT_RATIOS["16:9"];
  const refWidth = referenceWidth && referenceWidth > 0 ? referenceWidth : DEFAULT_REFERENCE_WIDTH;
  const referenceHeight = Math.round((refWidth * config.height) / config.width);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${refWidth}px`;
  container.style.height = `${referenceHeight}px`;
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  const root = createRoot(container);

  const exportEl = await new Promise<HTMLDivElement>((resolve) => {
    root.render(
      createElement(SlidePreview, {
        template,
        speaker,
        ref: (el: HTMLDivElement | null) => {
          if (el) resolve(el);
        },
      }),
    );
  });

  const images = exportEl.querySelectorAll("img");
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );

  await new Promise((r) => setTimeout(r, 100));

  const dataUrl = await toPng(exportEl, {
    pixelRatio: config.width / refWidth,
    cacheBust: true,
  });

  root.unmount();
  document.body.removeChild(container);

  return dataUrl;
}

/**
 * Try to fetch the server-rendered PNG for an (event, slide, speaker) combo
 * from `/api/admin/slide-render`. Returns a data URL on success, or `null`
 * when the server pipeline is unavailable / not applicable.
 *
 * The standalone editor falls back to {@link renderSlideToDataURL} when this
 * returns null — that keeps the editor working in local dev (no BROWSER
 * binding) and for the `"global"` scope where there's no event context.
 */
export async function renderSlideViaServer(args: {
  eventId: string;
  slideId: string;
  speakerId: string;
  refWidth?: number;
}): Promise<string | null> {
  const query = new URLSearchParams({
    eventId: args.eventId,
    slideId: args.slideId,
    speakerId: args.speakerId,
  });
  if (args.refWidth && Number.isFinite(args.refWidth)) {
    query.set("refWidth", String(Math.round(args.refWidth)));
  }
  let res: Response;
  try {
    res = await fetch(`/api/admin/slide-render?${query.toString()}`, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (res.status === 503) return null; // BROWSER binding not configured
  if (!res.ok) {
    // Bubble up real failures so callers can decide whether to fall back or
    // surface the error. 4xx is unlikely here (admin gate); treat as fatal.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // ignore
    }
    throw new Error(`Server slide render failed: ${detail}`);
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read server render"));
    reader.readAsDataURL(blob);
  });
}

export function downloadDataURL(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Bundle a set of PNG data URLs into a single .zip and trigger a download.
 * `entries` keep their original filenames inside the archive; duplicates get
 * an incrementing suffix so nothing is silently overwritten.
 */
export async function downloadDataURLsAsZip(
  entries: { dataUrl: string; filename: string }[],
  zipFilename: string,
): Promise<void> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const { dataUrl, filename } of entries) {
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    let name = filename;
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const stem = dot >= 0 ? name.slice(0, dot) : name;
      const ext = dot >= 0 ? name.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem}_${n}${ext}`)) n++;
      name = `${stem}_${n}${ext}`;
    }
    used.add(name);
    zip.file(name, base64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
