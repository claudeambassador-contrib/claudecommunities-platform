import { describe, expect, it } from "vitest";
import { requestImageUploadUrl } from "@/modules/system/services/uploadService";

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
