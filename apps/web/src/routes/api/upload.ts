import { createFileRoute } from "@tanstack/react-router";
import { isStorageConfigured } from "@/shared/storage/r2";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isStorageConfigured()) {
          return Response.json({ error: "storage_unavailable" }, { status: 503 });
        }
        const { getRegistryDb } = await import("@/shared/db/env");
        const { syncSessionUser } = await import("@/modules/identity/services/sessionService");
        const session = await syncSessionUser(getRegistryDb());
        if (!session.ok) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { storeUpload } = await import("@/modules/system/services/uploadService");
        const result = await storeUpload(await request.formData());
        if (!result.ok) {
          return Response.json({ error: result.error.code }, { status: result.error.status });
        }
        return Response.json({ key: result.key, url: result.url });
      },
    },
  },
});
