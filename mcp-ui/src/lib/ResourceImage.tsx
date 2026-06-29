/**
 * `<img>` wrapper that resolves `/api/files/...` URLs through the MCP host
 * bridge (see `useResourceImage`). Use this anywhere the iframe needs to
 * display an R2-backed image — direct `<img src="/api/files/...">` won't
 * work because the iframe runs at a sandboxed host origin.
 *
 * Falls back to a placeholder slot (`fallback`) while loading or on error;
 * for absolute http(s) URLs the hook short-circuits and renders immediately
 * without a bridge call.
 */
import type { App } from "@modelcontextprotocol/ext-apps";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { useResourceImage } from "./useResourceImage";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  app: App | null;
  url: string | null | undefined;
  fallback?: ReactNode;
}

export function ResourceImage({ app, url, fallback, alt = "", ...rest }: Props) {
  const { src } = useResourceImage(app, url ?? null);
  if (!src) return <>{fallback ?? null}</>;
  // biome-ignore lint/performance/noImgElement: vite app, no Next image optimization needed
  return <img {...rest} src={src} alt={alt} />;
}
