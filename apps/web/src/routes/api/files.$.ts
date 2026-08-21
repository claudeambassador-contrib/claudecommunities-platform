import { createFileRoute } from "@tanstack/react-router";

import { getObject } from "@/shared/storage/r2";

export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = params._splat ?? "";
        if (!key) {
          return new Response("Not found", { status: 404 });
        }
        const obj = await getObject(key);
        if (!obj) {
          return new Response("Not found", { status: 404 });
        }
        const headers = new Headers();
        if (obj.httpMetadata?.contentType) {
          headers.set("content-type", obj.httpMetadata.contentType);
        }
        headers.set("cache-control", "public, max-age=31536000, immutable");
        return new Response(obj.body, { headers });
      },
    },
  },
});
