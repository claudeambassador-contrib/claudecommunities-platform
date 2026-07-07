import { getCities } from "@/lib/cities-data";
import { getIndustrySlugs } from "@/lib/industries";
import { siteUrl } from "@/lib/region";
import { listEventSitemapEntries } from "@/lib/services/events";
import { getResources } from "@/lib/services/resources";

// Event entries are read from D1 at request time; without this the route
// would be prerendered at build, where no DB binding exists.
export const dynamic = "force-dynamic";

const baseUrl = siteUrl();

/**
 * Stable build-time date used for <lastmod> on static/marketing routes.
 *
 * We deliberately do NOT use new Date() at request time: a lastmod that changes
 * on every fetch is noise that Google discounts. Instead we use a single
 * constant injected at build/deploy time. If no build-time value is available
 * (or it isn't a valid date) we omit <lastmod> entirely for those entries — an
 * absent lastmod is strictly better than a fake always-now one.
 */
function resolveBuildDate(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_BUILD_TIME ?? process.env.BUILD_TIME;
  return toW3CDate(raw);
}

/** Format an ISO-ish date string to a W3C date (YYYY-MM-DD), or undefined if invalid. */
function toW3CDate(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

const BUILD_DATE = resolveBuildDate();

interface SitemapEntry {
  url: string;
  /** W3C date (YYYY-MM-DD) or undefined to omit <lastmod>. */
  lastModified?: string;
  changeFrequency: string;
  priority: number;
}

function buildEntry(
  url: string,
  changeFrequency: string,
  priority: number,
  lastModified: string | undefined = BUILD_DATE,
): SitemapEntry {
  return { url, lastModified, changeFrequency, priority };
}

/** Defensive XML escaping for values interpolated into the sitemap. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  // Active event detail pages. The sitemap must never 500 over a DB hiccup —
  // crawlers treat a broken sitemap worse than a shorter one — so fall back
  // to the static entries only.
  let eventEntries: SitemapEntry[] = [];
  try {
    const events = await listEventSitemapEntries();
    eventEntries = events
      .map((e) =>
        buildEntry(
          `${baseUrl}/events/${e.slug || e.id}`,
          "weekly",
          0.75,
          toW3CDate(e.updatedAt.toISOString()),
        ),
      )
      // The Impact Lab event has a dedicated static page listed explicitly below.
      .filter((e) => !e.url.includes("/events/claude-impact-lab-melbourne"));
  } catch (err) {
    console.error("sitemap: failed to load event entries", err);
  }

  // Per-tenant resource detail pages (DB-backed). Same fail-soft contract as events.
  let resourceEntries: SitemapEntry[] = [];
  try {
    const resources = await getResources();
    resourceEntries = resources.map((r) =>
      buildEntry(`${baseUrl}/resources/${r.slug}`, "monthly", 0.75, toW3CDate(r.publishedAt)),
    );
  } catch (err) {
    console.error("sitemap: failed to load resource entries", err);
  }

  const cities = await getCities();
  const industrySlugs = await getIndustrySlugs();

  const entries: SitemapEntry[] = [
    buildEntry(baseUrl, "weekly", 1),
    buildEntry(`${baseUrl}/events`, "daily", 0.9),
    ...eventEntries,
    buildEntry(`${baseUrl}/courses`, "daily", 0.85),
    buildEntry(`${baseUrl}/resources`, "weekly", 0.85),
    // Per-entity lastmod derives from each resource's own publishedAt (built above).
    ...resourceEntries,
    buildEntry(`${baseUrl}/for`, "weekly", 0.8),
    ...industrySlugs.map((slug) => buildEntry(`${baseUrl}/for/${slug}`, "weekly", 0.85)),
    buildEntry(`${baseUrl}/cowork`, "weekly", 0.8),
    buildEntry(`${baseUrl}/professionals`, "monthly", 0.7),
    buildEntry(`${baseUrl}/vibe-coders`, "monthly", 0.7),
    buildEntry(`${baseUrl}/pricing`, "monthly", 0.7),
    buildEntry(`${baseUrl}/merch`, "weekly", 0.75),
    buildEntry(`${baseUrl}/speak`, "monthly", 0.7),
    // NOTE: `/community` is intentionally NOT listed — it is the authenticated
    // members' feed (force-dynamic, redirects logged-out visitors to login), so
    // it must not be advertised to crawlers. Only the public `/community/*`
    // content pages (e.g. guidelines) belong in the sitemap.
    buildEntry(`${baseUrl}/community/guidelines`, "monthly", 0.4),
    buildEntry(`${baseUrl}/webinars/claude-code-webinar-australia`, "monthly", 0.7),
    buildEntry(`${baseUrl}/events/claude-impact-lab-melbourne`, "weekly", 0.8),
    buildEntry(`${baseUrl}/events/claude-impact-lab-melbourne/sponsor`, "monthly", 0.6),
    buildEntry(`${baseUrl}/sitemap`, "monthly", 0.3),
    // Capital cities rank above regional cities (city.isCapital).
    ...cities.map((city) =>
      buildEntry(`${baseUrl}/cities/${city.slug}`, "weekly", city.isCapital ? 0.8 : 0.7),
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => {
    const lastmod = e.lastModified ? `\n    <lastmod>${e.lastModified}</lastmod>` : "";
    return `  <url>
    <loc>${escapeXml(e.url)}</loc>${lastmod}
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
