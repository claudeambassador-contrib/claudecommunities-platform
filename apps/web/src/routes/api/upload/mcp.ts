import { createFileRoute } from "@tanstack/react-router";
import { actorFromBearer } from "@/modules/system/services/mcpHttp";
import { storeUpload } from "@/modules/system/services/uploadService";
import { workerEnv } from "@/shared/db/env";
import { isStorageConfigured } from "@/shared/storage/r2";

const CORS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const Route = createFileRoute("/api/upload/mcp")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { headers: CORS, status: 204 }),
      POST: async ({ request }) => {
        if (!isStorageConfigured()) {
          return withCors(Response.json({ error: "storage_unavailable" }, { status: 503 }));
        }
        const actor = await actorFromBearer(request, workerEnv());
        if (!actor) {
          return withCors(Response.json({ error: "Unauthorized" }, { status: 401 }));
        }
        const result = await storeUpload(await request.formData());
        if (!result.ok) {
          return withCors(
            Response.json({ error: result.error.code }, { status: result.error.status }),
          );
        }
        return withCors(Response.json({ key: result.key, url: result.url }));
      },
    },
  },
});
