import { createFileRoute } from "@tanstack/react-router";
import { syncSessionUser } from "@/modules/identity/services/sessionService";
import { storeUpload } from "@/modules/system/services/uploadService";
import { getRegistryDb } from "@/shared/db/env";
import { isStorageConfigured } from "@/shared/storage/r2";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isStorageConfigured()) {
          return Response.json({ error: "storage_unavailable" }, { status: 503 });
        }
        const session = await syncSessionUser(getRegistryDb());
        if (!session.ok) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const result = await storeUpload(await request.formData());
        if (!result.ok) {
          return Response.json({ error: result.error.code }, { status: result.error.status });
        }
        return Response.json({ key: result.key, url: result.url });
      },
    },
  },
});
