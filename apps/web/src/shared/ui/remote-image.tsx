import type { ImgHTMLAttributes, ReactElement } from "react";

/**
 * Sanctioned `<img>` for remote / user-supplied images (covers, previews,
 * thumbnails) that cannot go through a first-party image optimizer.
 */
export function RemoteImage({
  alt = "",
  height = 450,
  width = 800,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>): ReactElement {
  return <img alt={alt} height={height} width={width} {...props} />;
}
