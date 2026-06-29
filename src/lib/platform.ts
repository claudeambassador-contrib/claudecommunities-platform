export const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare";

/**
 * Platform-level identity — the PLATFORM itself (the apex
 * `claudecommunities.com`), as distinct from any single community/tenant.
 *
 * A tenant's identity is per-tenant and runtime-resolved via
 * `getTenantConfig()` (`src/lib/tenant-config.ts`). The platform directory and
 * console are not a tenant, so they read these plain build-time constants.
 */
export const PLATFORM = {
  /** Display name shown in the directory header / metadata. */
  name: "Claude Communities",
  /** One-line tagline for the directory hero. */
  tagline: "The home for Claude Code communities around the world.",
  /** Longer hero blurb. */
  description:
    "Discover and join your local Claude Code community — country and region groups for developers building with Claude.",
  /** Shared logo asset (also used by tenants). */
  logo: "/images/claude-code-logo.webp",
  /** OpenGraph share image for the platform landing. */
  ogImage: "/images/og-image.png",
  /** Support / contact email for the platform. */
  supportEmail: "hello@claudecommunities.com",
} as const;
