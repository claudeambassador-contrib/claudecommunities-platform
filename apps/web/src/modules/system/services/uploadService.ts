import type { ImageUploadPorts } from "@/modules/system/types";
import { err, ok, type Result } from "@/shared/http/errors";

export interface ImageUploadCredentials {
  curlCommand: string;
  note: string;
  uploadUrl: string;
}

const DEFAULT_FOLDER = "community/posts";
const NOTE =
  'Replace FILE_PATH with the actual local path to your image. The response will contain a "url" field — pass that as imageUrl to createPost or updatePost.';
const TRAILING_SLASH = /\/$/;

export function requestImageUploadUrl(
  ports: ImageUploadPorts,
  input: { folder?: string } = {},
): Result<ImageUploadCredentials> {
  const baseUrl = ports.baseUrl.replace(TRAILING_SLASH, "");
  if (!baseUrl) {
    return err("unavailable", 503, "Upload base URL is not configured");
  }
  if (!ports.token) {
    return err("unauthenticated", 401, "No auth token available");
  }
  const folder = input.folder?.trim() || DEFAULT_FOLDER;
  const uploadUrl = `${baseUrl}/api/upload/mcp`;
  const curlCommand = [
    `curl -s -X POST "${uploadUrl}"`,
    `-H "Authorization: Bearer ${ports.token}"`,
    `-F "file=@FILE_PATH;type=image/jpeg"`,
    `-F "folder=${folder}"`,
  ].join(" \\\n  ");
  return ok({ curlCommand, note: NOTE, uploadUrl });
}
