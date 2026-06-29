import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import Providers from "@/components/Providers";
import { getCities } from "@/lib/cities-data";
import { getTenantBase } from "@/lib/tenant-base";
import {
  formatOgLocale,
  getTenantConfig,
  TENANT_CONFIG_DEFAULTS,
  type TenantConfig,
} from "@/lib/tenant-config";
import { getTenantIdOrNull } from "@/lib/tenant-context";

// The root layout wraps tenant pages AND static system pages (/_not-found and
// error fallbacks) that have NO tenant at build time. getTenantConfig()/getTenantId()
// are fail-closed (throw) with no scope, so resolve null-tolerantly: real requests
// carry the middleware tenant header (the layout reads headers → stays dynamic and
// renders per-tenant at runtime); the build-time static fallback uses defaults.
async function resolveLayoutConfig(): Promise<{
  tenantId: string | null;
  config: TenantConfig;
  tenantBase: string;
}> {
  const tenantId = await getTenantIdOrNull();
  const config = tenantId ? await getTenantConfig() : TENANT_CONFIG_DEFAULTS;
  // "" for host-based tenancy (and at build time); "/<slug>" only under
  // path-prefix tenancy — seeded to the client so in-tenant links re-attach it.
  const tenantBase = await getTenantBase();
  return { tenantId, config, tenantBase };
}

// Clerk's publishable key encodes the Frontend API host as base64 (with a
// trailing "$"). Decode it so preconnect hints follow whichever Clerk
// instance (dev vs. production) the deploy is actually using.
function clerkFrontendApiUrl(): string | null {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) return null;
  const match = pk.match(/^pk_(?:test|live)_(.+)$/);
  if (!match) return null;
  try {
    const host = atob(match[1]).replace(/\$+$/, "");
    return host ? `https://${host}` : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await resolveLayoutConfig();
  const { communityName, countryName, ogImage } = config;
  const description = `Join ${countryName}'s Claude Code community. Connect with developers using AI-assisted coding, attend local meetups, and grow your skills.`;
  const ogDescription = `Join ${countryName}'s Claude Code community. Developer meetups across ${countryName}.`;

  return {
    metadataBase: new URL(config.siteUrl),
    title: {
      default: communityName,
      template: `%s | ${communityName}`,
    },
    description,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Claude Code Community",
    },
    icons: {
      icon: [{ url: "/icons/favicon.png", sizes: "512x512", type: "image/png" }],
      apple: [{ url: "/icons/favicon.png", sizes: "512x512", type: "image/png" }],
    },
    formatDetection: {
      telephone: false,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName: communityName,
      title: communityName,
      description: ogDescription,
      locale: formatOgLocale(config.lang),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `Claude Code Meetups Across ${countryName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: communityName,
      description: ogDescription,
      images: [ogImage],
    },
    // Add google verification: { google: 'YOUR_CODE' } once you have it from Google Search Console
  };
}

export const viewport: Viewport = {
  themeColor: "#D4836A",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkUrl = clerkFrontendApiUrl();
  const { config, tenantId, tenantBase } = await resolveLayoutConfig();
  const cities = tenantId ? await getCities() : [];
  const { lang, gaId } = config;
  return (
    <html lang={lang} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* Google Analytics (GA4) — region-specific id, skipped when unset */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        {clerkUrl && (
          <>
            <link rel="preconnect" href={clerkUrl} />
            <link rel="dns-prefetch" href={clerkUrl} />
          </>
        )}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        <Providers
          tenantConfig={config}
          tenantId={tenantId ?? ""}
          tenantBase={tenantBase}
          cities={cities}
        >
          <ConditionalLayout>{children}</ConditionalLayout>
        </Providers>
      </body>
    </html>
  );
}
