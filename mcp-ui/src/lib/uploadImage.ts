/**
 * Upload an image file to the claudecommunity R2 bucket by POSTing
 * multipart/form-data to /api/upload/mcp with the bearer token the
 * host MCP server attached in tool result `_meta.bearerToken`.
 */
export interface UploadResult {
  success: boolean;
  url: string;
}

export async function uploadImage(opts: {
  file: File;
  folder: string;
  origin: string;
  bearerToken: string;
}): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", opts.file);
  form.append("folder", opts.folder);

  const res = await fetch(`${opts.origin}/api/upload/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.bearerToken}` },
    body: form,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // ignore
    }
    throw new Error(`Upload failed: ${detail}`);
  }

  return (await res.json()) as UploadResult;
}
