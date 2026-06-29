/**
 * MCP dynamic resource templates that back the in-MCP UI iframes.
 *
 * The iframes (`mcp-ui/src/views/*.tsx`) load over the host's
 * `*.claudemcpcontent.com` origin, where relative `/api/files/...` URLs and
 * CSP both prevent direct image fetches against the staging/prod API. To
 * sidestep that, the iframes read images through `app.readServerResource()`
 * (proxied via the MCP host) and turn the returned bytes into blob URLs.
 *
 * Two resources here:
 *  - `ccau://slides/{eventId}/{slideId}/{speakerId}` — server-rendered slide
 *    PNG via Cloudflare Browser Rendering, cached in R2. Used by the
 *    SlidesPreview iframe.
 *  - `ccau://files/{+key}` — generic R2 passthrough for any object served
 *    by `/api/files/<key>`. Used by SpeakerManager avatar bubbles and any
 *    other surface that needs to show R2-stored images inside the iframe.
 *
 * Both require admin (the slide pipeline and per-event speakers are admin-
 * only data). The handlers throw, which the SDK maps to an MCP error
 * response — non-admin clients get an unauthorized error rather than data.
 */
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { renderSlidePng } from "@/lib/services/slideRender";
import { getObject } from "@/lib/services/uploads";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function ensureAdmin(isAdmin: boolean) {
  if (!isAdmin) {
    throw new Error("Admin access required to read this resource");
  }
}

function strVar(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join("/");
  return "";
}

export function registerMcpResources(server: McpServer, options: { isAdmin: boolean }) {
  // ─── ccau://slides/{eventId}/{slideId}/{speakerId} ──────────────────
  server.registerResource(
    "claudecommunity-slide-png",
    new ResourceTemplate("ccau://slides/{eventId}/{slideId}/{speakerId}", {
      list: undefined,
    }),
    {
      title: "Slide preview PNG",
      description:
        "Server-rendered PNG for a single (slide template × speaker) combo. Cached in R2 keyed by the slide's content hash; re-renders only when the template or speaker visibly changes.",
      mimeType: "image/png",
    },
    async (uri, variables) => {
      ensureAdmin(options.isAdmin);
      const eventId = strVar(variables.eventId);
      const slideId = strVar(variables.slideId);
      const speakerId = strVar(variables.speakerId);
      if (!eventId || !slideId || !speakerId) {
        throw new Error("eventId, slideId, speakerId are all required");
      }
      const result = await renderSlidePng({ eventId, slideId, speakerId });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: result.mimeType,
            blob: bytesToBase64(result.bytes),
          },
        ],
      };
    },
  );

  // ─── ccau://files/{+key} ────────────────────────────────────────────
  // `{+key}` lets the key include `/` (e.g. `speakers/headshots/abc.jpg`).
  server.registerResource(
    "claudecommunity-file",
    new ResourceTemplate("ccau://files/{+key}", { list: undefined }),
    {
      title: "R2-stored file",
      description:
        "Reads an object from the app's R2 bucket by key. Used by MCP UI iframes to display images that would otherwise hit CORS or relative-URL issues across the host iframe origin.",
    },
    async (uri, variables) => {
      ensureAdmin(options.isAdmin);
      const key = strVar(variables.key);
      if (!key) throw new Error("key is required");
      const obj = await getObject(key);
      if (!obj) throw new Error(`File not found: ${key}`);
      const bytes = new Uint8Array(await obj.arrayBuffer());
      const mimeType = obj.httpMetadata?.contentType || "application/octet-stream";
      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            blob: bytesToBase64(bytes),
          },
        ],
      };
    },
  );
}
