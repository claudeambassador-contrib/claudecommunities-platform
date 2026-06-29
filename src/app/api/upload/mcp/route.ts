import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getActorPermissions, hasAnyAdminPermission } from "@/lib/permissions";
import {
  assertUploadAllowed,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  putFile,
  StorageError,
} from "@/lib/services/uploads";
import { getActorByClerkId } from "@/lib/services/users";
import { HOME_TENANT, runWithTenant } from "@/lib/tenant-context";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    assertUploadAllowed(request);
  } catch (err) {
    if (err instanceof Error && "status" in err) {
      const e = err as Error & { status: number };
      return withCors(NextResponse.json({ error: e.message }, { status: e.status }));
    }
    throw err;
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  let clerkId: string | undefined;
  try {
    const authResult = await auth({ acceptsToken: "oauth_token" });
    const authInfo = await verifyClerkToken(authResult, token);
    clerkId = (authInfo as { extra?: { userId?: string } })?.extra?.userId;
  } catch {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  if (!clerkId) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const actor = await getActorByClerkId(clerkId);
  if (!actor) {
    return withCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }
  // MCP has no URL tenant → resolve membership perms against the home tenant.
  const { permissions: perms } = await runWithTenant(HOME_TENANT, () =>
    getActorPermissions(actor.id),
  );
  if (!hasAnyAdminPermission({ permissions: perms })) {
    return withCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return withCors(NextResponse.json({ error: "Invalid form data" }, { status: 400 }));
  }

  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "community/posts";
  if (!file) {
    return withCors(NextResponse.json({ error: "No file provided" }, { status: 400 }));
  }

  try {
    const result = await putFile(file, {
      folder,
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_SIZE,
    });
    return withCors(NextResponse.json({ success: true, url: result.url }));
  } catch (err) {
    if (err instanceof StorageError) {
      return withCors(NextResponse.json({ error: err.message }, { status: err.status }));
    }
    console.error("MCP upload failed:", err);
    return withCors(NextResponse.json({ error: "Upload failed" }, { status: 500 }));
  }
}
