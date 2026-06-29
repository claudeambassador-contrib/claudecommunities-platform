/**
 * Upload a single local file to R2 with a deterministic key (no random UUID).
 * Use for assets that need a stable URL — e.g. default email header.
 *
 * Usage: bun scripts/upload-r2-asset.ts <localPath> <r2Key> [contentType]
 */
import * as dotenv from "dotenv";

dotenv.config();

import { AwsClient } from "aws4fetch";
import { readFileSync } from "fs";
import { extname } from "path";

const localPath = process.argv[2];
const key = process.argv[3];
const explicitContentType = process.argv[4];

if (!localPath || !key) {
  console.error("Usage: tsx scripts/upload-r2-asset.ts <localPath> <r2Key> [contentType]");
  process.exit(1);
}

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
  console.error("Missing R2_* env vars in .env");
  process.exit(1);
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

const contentType =
  explicitContentType || MIME[extname(localPath).toLowerCase()] || "application/octet-stream";

async function main() {
  const body = readFileSync(localPath);
  const client = new AwsClient({
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    service: "s3",
    region: "auto",
  });
  const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURI(key)}`;

  const res = await client.fetch(objectUrl, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });

  if (!res.ok) {
    console.error(`PUT failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log(`uploaded ${body.byteLength} B as ${contentType}`);
  console.log(`${publicUrl}/${key}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
