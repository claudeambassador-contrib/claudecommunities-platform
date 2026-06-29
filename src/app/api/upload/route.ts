import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/_errors";
import { withService } from "@/lib/services/_route";
import { assertUploadAllowed, putDataUrl, putFile, StorageError } from "@/lib/services/uploads";

function storageErrorResponse(err: unknown): NextResponse {
  if (err instanceof StorageError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export const POST = withService(async (request) => {
  assertUploadAllowed(request);

  const user = await getCurrentUser();
  if (!user) {
    throw new ServiceError("unauthenticated", "Unauthorized");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ServiceError("bad_request", "Invalid form data");
  }

  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "community";
  if (!file) {
    throw new ServiceError("bad_request", "No file provided");
  }

  try {
    const result = await putFile(file, { folder });
    return NextResponse.json({
      success: true,
      url: result.url,
      publicId: result.key,
      format: result.format,
      resourceType: result.resourceType,
      bytes: result.bytes,
      originalName: file.name,
      mimeType: result.contentType,
    });
  } catch (err) {
    return storageErrorResponse(err);
  }
});

// Base64 data URL path (kept for backwards compatibility).
export const PUT = withService(async (request) => {
  assertUploadAllowed(request);

  const user = await getCurrentUser();
  if (!user) {
    throw new ServiceError("unauthenticated", "Unauthorized");
  }

  const body = await request.json();
  const { data, folder = "community" } = body as { data?: string; folder?: string };
  if (typeof data !== "string") {
    throw new ServiceError("bad_request", "data must be a base64 data URL");
  }
  if (data.length > 140 * 1024 * 1024) {
    throw new ServiceError("bad_request", "Payload too large");
  }

  try {
    const result = await putDataUrl(data, { folder });
    return NextResponse.json({
      success: true,
      url: result.url,
      publicId: result.key,
      format: result.format,
      resourceType: result.resourceType,
      bytes: result.bytes,
    });
  } catch (err) {
    return storageErrorResponse(err);
  }
});
