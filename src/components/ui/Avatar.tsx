/* eslint-disable @next/next/no-img-element -- This component IS the sanctioned raw <img> wrapper; see the doc comment below. */
import type { ImgHTMLAttributes } from "react";

interface AvatarProps {
  /** Image URL; when absent/null the initial fallback box is rendered. */
  src?: string | null;
  /** Derives the fallback initial and the default `alt` text. */
  name?: string | null;
  /** Explicit `alt` for the image; defaults to `name ?? ""`. */
  alt?: string;
  /**
   * Classes applied to BOTH the `<img>` and the fallback box — the shared shape
   * only (sizing, rounding), e.g. `w-12 h-12 rounded-full`.
   */
  className?: string;
  /**
   * Classes applied to the `<img>` ONLY — anything that should not appear on the
   * fallback box, e.g. an image-only `ring-2 ring-white/10`.
   */
  imgClassName?: string;
  /**
   * Classes applied to the fallback box ONLY — its gradient/background, text
   * color, weight, and size, e.g. `bg-gradient-to-br from-[#D4836A] to-[#B66B54]
   * text-white font-bold text-lg`. The fallback bakes in nothing but flex
   * centering, so pass whatever the original fallback had.
   */
  fallbackClassName?: string;
  /** Extra attributes forwarded to the `<img>` (e.g. `loading`, `draggable`). */
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">;
}

/**
 * Avatar — the single sanctioned `<img>` for user/member/author/speaker avatars.
 * Renders the image when `src` is present, otherwise a box with the name's first
 * initial. Centralizes the duplicated initial-fallback markup and the
 * `noImgElement` suppression (which only fires on the raw `<img>` inside).
 *
 * Styling is intentionally explicit so swaps are faithful 1:1: only `object-cover`
 * (image) and `flex items-center justify-center` (fallback) are baked in. Put the
 * shared shape in `className`, image-only extras in `imgClassName`, and the whole
 * fallback look (gradient + text color/weight/size) in `fallbackClassName`.
 */
export function Avatar({
  src,
  name,
  alt,
  className = "",
  imgClassName = "",
  fallbackClassName = "",
  imgProps,
}: AvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: sanctioned avatar wrapper — user-supplied hosts not in next/image remotePatterns
      <img
        src={src}
        alt={alt ?? name ?? ""}
        className={`object-cover ${className} ${imgClassName}`}
        {...imgProps}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center ${className} ${fallbackClassName}`}>
      {initial}
    </div>
  );
}
