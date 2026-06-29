/**
 * MCP UI tools — opens an in-MCP iframe view for the speaker manager
 * and the slides preview. The iframe HTML is bundled by `mcp-ui/` and
 * inlined into `ui-bundle.generated.ts` at build time.
 */
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTenantConfig } from "@/lib/tenant-config";
import { HOME_TENANT, runWithTenant } from "@/lib/tenant-context";
import { registerMcpResources } from "./resources";
import { MCP_UI_HTML } from "./ui-bundle.generated";

const RESOURCE_URI = "ui://claudecommunity/mcp-app";

interface AuthInfoLike {
  token?: string;
  extra?: { userId?: string };
}

// MCP carries no URL tenant, so resolve the home tenant's appUrl in its own
// HOME_TENANT scope (nestable; safe in both withMcpService-wrapped and bare
// handlers).
async function getOriginFromEnv(): Promise<string> {
  return runWithTenant(HOME_TENANT, async () => (await getTenantConfig()).appUrl);
}

function structuredOpenResult(args: {
  view: "speakers" | "slides";
  eventId: string;
  meta?: Record<string, unknown>;
}) {
  return {
    structuredContent: { view: args.view, eventId: args.eventId },
    content: [
      {
        type: "text" as const,
        text:
          args.view === "speakers"
            ? `Opening speaker manager for event ${args.eventId}.`
            : `Opening slides preview for event ${args.eventId}.`,
      },
    ],
    _meta: args.meta ?? {},
  };
}

export function registerUiTools(server: McpServer, options: { isAdmin: boolean }) {
  // The HTML resource the tools point at.
  registerAppResource(server, "Claude Community MCP UI", RESOURCE_URI, {}, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: MCP_UI_HTML,
      },
    ],
  }));

  // Dynamic resources backing the iframe (slide PNGs + R2 file passthrough).
  // Their handlers throw for non-admins so the resource list is harmless to
  // expose; only authorized callers receive bytes.
  registerMcpResources(server, options);

  // Admin-only UIs follow.
  if (!options.isAdmin) return;

  registerAppTool(
    server,
    "openSpeakerManager",
    {
      title: "Open Speaker Manager",
      description:
        "Open the in-MCP UI for managing the curated speakers of an event (list, add, edit, reorder, delete, upload headshots). Pass the eventId. Admin only.",
      inputSchema: { eventId: z.string().describe("Event ID") },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ eventId }, { authInfo }) => {
      const token = (authInfo as AuthInfoLike | undefined)?.token;
      return structuredOpenResult({
        view: "speakers",
        eventId,
        meta: {
          bearerToken: token,
          origin: await getOriginFromEnv(),
        },
      });
    },
  );

  registerAppTool(
    server,
    "openSlidesPreview",
    {
      title: "Open Slides Preview",
      description:
        "Open the in-MCP UI showing a read-only preview of the slides generated for an event. Admin only.",
      inputSchema: { eventId: z.string().describe("Event ID") },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ eventId }) => structuredOpenResult({ view: "slides", eventId }),
  );
}
