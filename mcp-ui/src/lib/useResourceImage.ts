/**
 * Hook that resolves an image URL to a renderable `src` from the MCP host.
 *
 * Why this exists: the MCP UI iframe runs at a sandboxed host origin
 * (`*.claudemcpcontent.com`). Relative `/api/files/<key>` URLs resolve
 * against that origin (→ 404), and the iframe's CSP blocks cross-origin
 * fetches against the staging/prod app. Going through `app.readServerResource`
 * uses the host's existing MCP connection, so neither origin nor CSP matters.
 *
 * Behavior:
 *  - `null` / `""` / `undefined` input → returns `null`
 *  - absolute http(s) URL → returned as-is (no fetch)
 *  - `/api/files/<key>` → read `ccau://files/<key>` via the bridge, return a
 *    blob URL. Revoked on unmount or when the input changes.
 *  - `ccau://...` or any other custom scheme → read via bridge as-is.
 */
import type { App } from "@modelcontextprotocol/ext-apps";
import { useEffect, useState } from "react";

type ResourceContent =
  | { uri: string; mimeType?: string; blob?: string; text?: string }
  | undefined;

function pickBlobContent(contents: unknown): ResourceContent {
  if (!Array.isArray(contents)) return undefined;
  for (const c of contents) {
    if (c && typeof c === "object" && "blob" in c && typeof (c as { blob?: string }).blob === "string") {
      return c as ResourceContent;
    }
  }
  return undefined;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err instanceof Event) {
    const target = err.target as { src?: string; url?: string } | null;
    const src = target?.src || target?.url;
    return src ? `${err.type} event (${src})` : `${err.type} event`;
  }
  try {
    const s = JSON.stringify(err);
    if (s && s !== "{}") return s;
  } catch {
    // fall through
  }
  return String(err);
}

function toResourceUri(url: string): string | null {
  if (url.startsWith("ccau://")) return url;
  if (url.startsWith("/api/files/")) {
    const key = url.slice("/api/files/".length);
    return `ccau://files/${key}`;
  }
  return null;
}

export function useResourceImage(app: App | null, url: string | null | undefined): {
  src: string | null;
  loading: boolean;
  error: string | null;
} {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!url) {
      setSrc(null);
      setLoading(false);
      return;
    }
    // Absolute external URLs are loaded directly by the browser — no bridge.
    if (/^https?:\/\//.test(url)) {
      setSrc(url);
      setLoading(false);
      return;
    }
    const resourceUri = toResourceUri(url);
    if (!resourceUri) {
      // Unknown shape — pass through; the consumer's <img> will surface the
      // failure if it's truly broken.
      setSrc(url);
      setLoading(false);
      return;
    }
    if (!app) {
      // Bridge not available yet (initial mount before App connects). Render
      // nothing rather than a stale URL.
      setSrc(null);
      return;
    }

    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setLoading(true);

    (async () => {
      try {
        const result = await app.readServerResource({ uri: resourceUri });
        if (cancelled) return;
        const content = pickBlobContent(result.contents);
        if (!content?.blob) {
          throw new Error("Resource returned no blob content");
        }
        const bytes = base64ToBytes(content.blob);
        const blob = new Blob([bytes], { type: content.mimeType || "application/octet-stream" });
        createdBlobUrl = URL.createObjectURL(blob);
        setSrc(createdBlobUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("[useResourceImage] read failed:", url, err);
          setError(formatErr(err));
          setSrc(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [app, url]);

  return { src, loading, error };
}
