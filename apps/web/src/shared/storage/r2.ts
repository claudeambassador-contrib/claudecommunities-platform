import { getStorageBucket } from "@/shared/db/env";

export class StorageError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function tenantObjectKey(r2Prefix: string, ...parts: string[]): string {
  const cleaned = parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean);
  return `${r2Prefix.replace(/\/+$/, "")}/${cleaned.join("/")}`;
}

export async function putBytes(
  key: string,
  bytes: ArrayBuffer | Uint8Array | string,
  contentType?: string,
): Promise<{ key: string }> {
  const bucket = getStorageBucket();
  if (!bucket) throw new StorageError("Storage not configured", 503);
  await bucket.put(key, bytes, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
  return { key };
}

export async function getObject(key: string): Promise<R2ObjectBody | null> {
  const bucket = getStorageBucket();
  if (!bucket) throw new StorageError("Storage not configured", 503);
  return bucket.get(key);
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = getStorageBucket();
  if (!bucket) throw new StorageError("Storage not configured", 503);
  await bucket.delete(key);
}

export function isStorageConfigured(): boolean {
  return getStorageBucket() != null;
}

export function publicUrl(key: string): string {
  return `/api/files/${key}`;
}
