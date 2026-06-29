/* eslint-disable @next/next/no-img-element -- This component IS the sanctioned raw <img> wrapper; see the doc comment below. */
import { forwardRef, type ImgHTMLAttributes } from "react";

/**
 * SlideImage — the single sanctioned `<img>` for the slide generator and other
 * html-to-image / canvas export paths (speaker headshots, company logos, slide
 * previews, QR codes). The PNG export pipeline traverses raw DOM `<img>` elements
 * and requires `crossOrigin` so remote images are exportable without tainting the
 * canvas; `next/image` is unavailable in that render path.
 *
 * Defaults `crossOrigin="anonymous"` (overridable) and forwards every other
 * `<img>` prop plus `ref`. Centralizes the `noImgElement` suppression in one place.
 */
export const SlideImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function SlideImage({ crossOrigin = "anonymous", alt = "", ...props }, ref) {
    // biome-ignore lint/performance/noImgElement: html-to-image PNG export requires a raw <img> with crossOrigin; next/image is unavailable in the export render path
    return <img ref={ref} alt={alt} crossOrigin={crossOrigin} {...props} />;
  },
);
