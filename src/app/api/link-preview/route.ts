import dns from "node:dns/promises";
import net from "node:net";
import { type NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// SSRF guard: reject anything that isn't a public http/https URL.
// Blocks loopback, link-local (incl. 169.254.169.254 cloud metadata),
// RFC1918 private space, CGNAT, multicast, and reserved ranges.
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) — extract and re-check
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

async function assertSafeUrl(rawUrl: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // Disallow custom ports outside well-known web ports to reduce internal scanning.
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return null;

  const host = parsed.hostname;
  // If host is already a literal IP, check it directly.
  if (net.isIP(host)) {
    if (net.isIP(host) === 4 ? isBlockedIPv4(host) : isBlockedIPv6(host)) return null;
    return parsed;
  }
  // Resolve and check every A/AAAA result.
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (addrs.length === 0) return null;
    for (const { address, family } of addrs) {
      if (family === 4 && isBlockedIPv4(address)) return null;
      if (family === 6 && isBlockedIPv6(address)) return null;
    }
  } catch {
    return null;
  }
  return parsed;
}

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

function getMetaContent(html: string, property: string): string | null {
  // Match both property="..." and name="..." attributes
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function getFavicon(html: string, baseUrl: string): string | null {
  const match =
    html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']*)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i);
  if (match?.[1]) {
    try {
      return new URL(match[1], baseUrl).href;
    } catch {
      return null;
    }
  }
  // Default to /favicon.ico
  try {
    return new URL("/favicon.ico", baseUrl).href;
  } catch {
    return null;
  }
}

function resolveUrl(url: string | null, baseUrl: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

async function fetchPreview(url: string): Promise<LinkPreviewData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Manual redirect handling so each hop is re-validated (defeats redirect-based SSRF
    // and DNS rebinding via Location: headers).
    let currentUrl = url;
    let res: Response | null = null;
    for (let hop = 0; hop < 5; hop++) {
      const safe = await assertSafeUrl(currentUrl);
      if (!safe) return null;
      res = await fetch(safe.href, {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
          Accept: "text/html",
        },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        currentUrl = new URL(loc, safe).href;
        continue;
      }
      break;
    }
    if (!res) return null;

    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) {
      return null;
    }

    // Read only first 50KB to avoid large pages
    const reader = res.body?.getReader();
    if (!reader) return null;

    let html = "";
    const decoder = new TextDecoder();
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const title = getMetaContent(html, "og:title") || getTitle(html);
    const description =
      getMetaContent(html, "og:description") || getMetaContent(html, "description");
    const image = resolveUrl(getMetaContent(html, "og:image"), url);
    const siteName = getMetaContent(html, "og:site_name");
    const favicon = getFavicon(html, url);

    if (!title && !description && !image) return null;

    return { url, title, description, image, siteName, favicon };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  // 30 / minute is well above any legitimate UI use, well below scraping abuse.
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "link-preview" });
  if (limited) return limited;

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate + SSRF guard before we do any work (and before caching the result).
  const safe = await assertSafeUrl(url);
  if (!safe) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const data = await cached<LinkPreviewData | null>(
    `link-preview:${url}`,
    () => fetchPreview(url),
    3600, // 1 hour TTL
  );

  if (!data) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-cache",
    },
  });
}
