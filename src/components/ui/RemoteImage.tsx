/* eslint-disable @next/next/no-img-element -- This component IS the sanctioned raw <img> wrapper; see the doc comment below. */
import type { ImgHTMLAttributes } from "react";

/**
 * RemoteImage — the single sanctioned `<img>` for arbitrary remote / user-supplied
 * images (event covers, link previews, course thumbnails, uploaded media) whose
 * hosts are not listed in `next.config` `images.remotePatterns`, so `next/image`
 * cannot render them without risking a runtime error.
 *
 * Centralizing the raw `<img>` here keeps `performance/noImgElement` /
 * `@next/next/no-img-element` suppressed in exactly one place instead of at every
 * call site. It is a thin pass-through: it accepts every standard `<img>` prop.
 *
 * For user avatars use `Avatar`; for slide/canvas PNG export use `SlideImage`.
 */
export function RemoteImage({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  // biome-ignore lint/performance/noImgElement: sanctioned wrapper for arbitrary remote hosts not in next/image remotePatterns
  return <img alt={alt} {...props} />;
}
