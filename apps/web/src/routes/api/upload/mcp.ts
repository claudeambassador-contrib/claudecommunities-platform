import { createFileRoute } from "@tanstack/react-router";
import { isStorageConfigured, publicUrl, putBytes } from "@/shared/storage/r2";

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
        const { actorFromBearer } = await import("@/modules/system/services/mcpHttp");
        const { workerEnv } = await import("@/shared/db/env");
        const actor = await actorFromBearer(request, workerEnv());
        if (!actor) {
          return withCors(Response.json({ error: "Unauthorized" }, { status: 401 }));
        }
        const form = await request.formData();
        const file = form.get("file");
        const folder = String(form.get("folder") ?? "uploads");
        if (!(file instanceof File)) {
          return withCors(Response.json({ error: "file_required" }, { status: 400 }));
        }
        const key = `${folder}/${crypto.randomUUID()}-${file.name}`;
        const buf = await file.arrayBuffer();
        await putBytes(key, buf, file.type || "application/octet-stream");
        return withCors(Response.json({ key, url: publicUrl(key) }));
      },
    },
  },
});
