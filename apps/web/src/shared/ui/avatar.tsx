import type { ImgHTMLAttributes, ReactElement } from "react";

export interface AvatarProps {
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  imgClassName?: string;
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "className" | "src">;
  name?: string | null;
  src?: string | null;
}

/**
 * Sanctioned `<img>` for user/member/author/speaker avatars.
 * Shared shape goes in `className`; image-only extras in `imgClassName`.
 */
export function Avatar({
  alt,
  className = "",
  fallbackClassName = "",
  imgClassName = "",
  imgProps,
  name,
  src,
}: AvatarProps): ReactElement {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      <img
        alt={alt ?? name ?? ""}
        className={`object-cover ${className} ${imgClassName}`}
        height={40}
        src={src}
        width={40}
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
