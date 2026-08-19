import { createFileRoute } from "@tanstack/react-router";
import { isStorageConfigured, publicUrl, putBytes } from "@/shared/storage/r2";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isStorageConfigured()) {
          return Response.json({ error: "storage_unavailable" }, { status: 503 });
        }
        const form = await request.formData();
        const file = form.get("file");
        const folder = String(form.get("folder") ?? "uploads");
        if (!(file instanceof File)) {
          return Response.json({ error: "file_required" }, { status: 400 });
        }
        const key = `${folder}/${crypto.randomUUID()}-${file.name}`;
        const buf = await file.arrayBuffer();
        await putBytes(key, buf, file.type || "application/octet-stream");
        return Response.json({ key, url: publicUrl(key) });
      },
    },
  },
});
