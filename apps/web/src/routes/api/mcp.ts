import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const { handleMcpHttp } = await import("@/modules/system/services/mcpHttp");
        return handleMcpHttp(request);
      },
      GET: async ({ request }) => {
        const { handleMcpHttp } = await import("@/modules/system/services/mcpHttp");
        return handleMcpHttp(request);
      },
      POST: async ({ request }) => {
        const { handleMcpHttp } = await import("@/modules/system/services/mcpHttp");
        return handleMcpHttp(request);
      },
    },
  },
});
