import { createFileRoute } from "@tanstack/react-router";
import { healthService } from "@/modules/system/services/healthService";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const body = await healthService();
        return Response.json(body);
      },
    },
  },
});
