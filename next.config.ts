import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Hyperdrive needs a local Postgres connection string when emulating bindings.
// We don't run a local Postgres — point it at the same Neon DB. Only used
// during `next dev`; ignored in prod where the real Hyperdrive is bound.
if (!process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_NEON_DB && process.env.DATABASE_URL) {
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_NEON_DB = process.env.DATABASE_URL;
}

// Make Workers bindings (env, ctx) available during `next dev` so behaviour matches prod.
initOpenNextCloudflareForDev();

// On Workers we MUST bundle Prisma so the bundler honors the `workerd` export
// condition — otherwise Prisma loads its WASM via base64 + dynamic compile,
// which Workers blocks ("Wasm code generation disallowed by embedder").
// Detect Workers build: opennextjs-cloudflare is invoked via the build:worker
// script. npm_lifecycle_event is auto-set by the package manager (bun/npm) to
// the script name.
const isWorkerBuild =
  process.env.npm_lifecycle_event === "build:worker" ||
  process.env.OPEN_NEXT_BUILD === "true" ||
  process.env.CLOUDFLARE_WORKER === "true";

// Security response headers applied to every rendered route (FAT audit P1).
// CSP is a deliberately permissive baseline: it still locks down framing
// (frame-ancestors), base-uri and plugins (object-src 'none'), but allows
// 'unsafe-inline'/'unsafe-eval' and https: sources so Next.js' injected inline
// scripts, Clerk, and GA keep working without nonces. Tighten to a nonce-based
// policy later — see SECURITY.md. HSTS uses a 1-year max-age + includeSubDomains
// (no `preload` yet, to avoid the irreversible preload-list commitment).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' https: data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Don't advertise the framework (FAT audit P3).
  poweredByHeader: false,
  serverExternalPackages: isWorkerBuild ? [] : ['@prisma/client', '.prisma/client', '@neondatabase/serverless', 'postgres'],
  webpack(config) {
    // @imgly/background-removal ships ONNX Runtime WASM files (~25 MB each)
    // that exceed Cloudflare Workers' asset size limit. The library is only
    // ever imported dynamically on the client, so we exclude the WASM from
    // the static asset pipeline and let the browser fetch them from the
    // imgly CDN at runtime (the default behaviour when publicPath is unset).
    config.module.rules.push({
      test: /ort-wasm.*\.wasm$/,
      type: "asset/resource",
      generator: { emit: false },
    });
    return config;
  },
  async rewrites() {
    return [
      // The Impact Lab Melbourne recap is a self-contained static bundle under
      // public/events/claude-impact-lab-melbourne/recap/. Serve its index.html
      // at the clean URL (no Next route owns this path). Asset URLs inside the
      // bundle are root-absolute, so they resolve independently of this rewrite.
      {
        source: "/events/claude-impact-lab-melbourne/recap",
        destination: "/events/claude-impact-lab-melbourne/recap/index.html",
      },
    ];
  },
  images: {
    // OpenNext on Cloudflare Workers has no working /_next/image optimizer
    // out of the box. Routing /api/files/<key> R2 images through
    // /_next/image?url=... returns broken responses, so <Image> renders a
    // broken tag right after upload (the blob URL briefly shows, then the
    // committed /api/files URL fails through the optimizer). Bypass the
    // optimizer and let <Image> emit the source URL directly. Switching to
    // the Cloudflare Images binding later would let us turn this back on.
    unoptimized: true,
    remotePatterns: [
      { hostname: 'img.clerk.com' },
      { hostname: 'images.clerk.dev' },
      { hostname: 'assets.claudecommunity.com.au' },
      { hostname: 'pub-27024d1895484e8c9e5dbc037aedba64.r2.dev' },
      { hostname: '*.r2.cloudflarestorage.com' },
      { hostname: '*.r2.dev' },
      { hostname: 'images.lumacdn.com' },
    ],
  },
};

export default nextConfig;
