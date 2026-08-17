import { createFileRoute } from "@tanstack/react-router";
import { handleMcpRequest } from "@/modules/system/services/mcpService";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: async ({ request }) => handleMcpRequest(request),
      POST: async ({ request }) => handleMcpRequest(request),
      DELETE: async ({ request }) => handleMcpRequest(request),
    },
  },
});
