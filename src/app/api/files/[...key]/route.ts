import { type NextRequest, NextResponse } from "next/server";
import { getObject } from "@/lib/services/uploads";

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params;
  if (!keyParts || keyParts.length === 0) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  const key = keyParts.map((p) => decodeURIComponent(p)).join("/");

  const object = await getObject(key);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("content-type", object.httpMetadata.contentType);
  }
  headers.set(
    "cache-control",
    object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable",
  );
  headers.set("etag", object.httpEtag);
  // Allow the MCP iframe (and other cross-origin embedders) to load these
  // images with `crossOrigin="anonymous"` so html-to-image can rasterize
  // them without tainting the canvas.
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(object.body as unknown as BodyInit, { headers });
}
