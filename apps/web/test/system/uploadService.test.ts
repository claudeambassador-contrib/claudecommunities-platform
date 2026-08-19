import { describe, expect, it, vi } from "vitest";

// uploadService imports @/shared/storage/r2, which imports @/shared/db/env,
// which imports the `cloudflare:workers` module — unavailable under vitest's
// node environment. Mock the storage seam so the pure functions (and
// storeUpload) can be exercised without a Worker runtime.
const { MockStorageError } = vi.hoisted(() => ({
  MockStorageError: class extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/shared/storage/r2", () => ({
  publicUrl: vi.fn((key: string) => `/api/files/${key}`),
  putBytes: vi.fn(async (key: string) => ({ key })),
  StorageError: MockStorageError,
  tenantObjectKey: vi.fn(
    (r2Prefix: string, ...parts: string[]) => `${r2Prefix}/${parts.join("/")}`,
  ),
}));

import {
  buildUploadKey,
  requestImageUploadUrl,
  sanitizeFilename,
  storeUpload,
} from "@/modules/system/services/uploadService";
import { putBytes, StorageError } from "@/shared/storage/r2";

const TENANT_KEY_RE = /^tenants\/sydney\/uploads\/[0-9a-f-]{36}-a\.png$/;
const PLAIN_KEY_RE = /^uploads\/[0-9a-f-]{36}-a\.png$/;
const SANITIZED_KEY_RE = /^uploads\/[0-9a-f-]{36}-photo-1\.PNG$/;

describe("requestImageUploadUrl", () => {
  it("builds the MCP upload curl for the default folder", () => {
    const result = requestImageUploadUrl({
      baseUrl: "https://example.test/",
      token: "tok_abc",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.uploadUrl).toBe("https://example.test/api/upload/mcp");
    expect(result.curlCommand).toContain('curl -s -X POST "https://example.test/api/upload/mcp"');
    expect(result.curlCommand).toContain("Authorization: Bearer tok_abc");
    expect(result.curlCommand).toContain("folder=community/posts");
  });

  it("uses the requested folder and rejects a missing token", () => {
    const withFolder = requestImageUploadUrl(
      { baseUrl: "https://example.test", token: "tok" },
      { folder: "events" },
    );
    expect(withFolder.ok).toBe(true);
    if (withFolder.ok) {
      expect(withFolder.curlCommand).toContain("folder=events");
    }

    const missing = requestImageUploadUrl({ baseUrl: "https://example.test", token: "" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.status).toBe(401);
    }
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators and odd characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFilename("photo (1).PNG")).toBe("photo-1.PNG");
  });
  it("falls back for empty results", () => {
    expect(sanitizeFilename("///")).toBe("file");
  });
});

describe("buildUploadKey", () => {
  it("prefixes with the tenant r2Prefix when given", () => {
    const result = buildUploadKey({
      filename: "a.png",
      folder: "uploads",
      r2Prefix: "tenants/sydney",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toMatch(TENANT_KEY_RE);
    }
  });
  it("builds an unprefixed key without a tenant", () => {
    const result = buildUploadKey({ filename: "a.png", folder: "uploads", r2Prefix: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toMatch(PLAIN_KEY_RE);
    }
  });
  it("rejects a folder with path tricks", () => {
    const result = buildUploadKey({ filename: "a.png", folder: "../secrets", r2Prefix: null });
    expect(result.ok).toBe(false);
  });
});

function formDataWith(fields: Record<string, string | File>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return form;
}

describe("storeUpload", () => {
  it("rejects a missing file", async () => {
    const result = await storeUpload(formDataWith({ folder: "uploads" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("file_required");
    }
  });

  it("rejects an invalid folder without calling putBytes", async () => {
    const file = new File(["hi"], "a.png", { type: "image/png" });
    const result = await storeUpload(formDataWith({ file, folder: "../secrets" }));
    expect(result.ok).toBe(false);
    expect(vi.mocked(putBytes)).not.toHaveBeenCalled();
  });

  it("stores the file and returns a key + url", async () => {
    const file = new File(["hi"], "photo (1).PNG", { type: "image/png" });
    const result = await storeUpload(formDataWith({ file, folder: "uploads" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toMatch(SANITIZED_KEY_RE);
      expect(result.url).toBe(`/api/files/${result.key}`);
    }
    expect(vi.mocked(putBytes)).toHaveBeenCalledOnce();
  });

  it("maps a StorageError from putBytes to a Result error", async () => {
    vi.mocked(putBytes).mockRejectedValueOnce(new StorageError("nope", 503));
    const file = new File(["hi"], "a.png", { type: "image/png" });
    const result = await storeUpload(formDataWith({ file, folder: "uploads" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("storage_unavailable");
      expect(result.error.status).toBe(503);
    }
  });
});
