"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import MilestoneCelebration from "./MilestoneCelebration";
import Navbar from "./Navbar";
import PageTransition from "./PageTransition";
import PWAInstall from "./PWAInstall";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import { useTenantId } from "./TenantConfigProvider";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The platform plane (apex directory + console) has NO tenant in scope. It
  // owns its own header/footer via the `(platform)` route-group layout, so the
  // community/marketing chrome below must NOT wrap it. (Flat routes like /login
  // on the apex still carry the home-tenant stamp, so they keep marketing chrome.)
  const isPlatformRoute = !useTenantId();
  const isCommunityRoute = pathname?.startsWith("/community");
  const isAdminRoute = pathname?.startsWith("/admin");
  const isImpactLabRoute = pathname?.startsWith("/impact-lab");
  // Bare-bones segment used by the puppeteer-driven slide renderer. No
  // navigation chrome, no transitions, no celebration/PWA chrome — just the
  // slide tree on a transparent page so Cloudflare Browser Rendering can
  // screenshot it without overlays polluting the PNG.
  const isInternalRoute = pathname?.startsWith("/internal");

  if (isInternalRoute) {
    return <>{children}</>;
  }

  if (isPlatformRoute) {
    return (
      <>
        {children}
        <PWAInstall />
        <ServiceWorkerRegistration />
      </>
    );
  }

  // The Impact Lab portal is a self-contained mini-app with its own layout.
  if (isImpactLabRoute) {
    return (
      <>
        {children}
        <PWAInstall />
        <ServiceWorkerRegistration />
        <MilestoneCelebration />
      </>
    );
  }

  // Community and admin pages have their own layouts
  if (isCommunityRoute || isAdminRoute) {
    return (
      <>
        <PageTransition>{children}</PageTransition>
        <PWAInstall />
        <ServiceWorkerRegistration />
        <MilestoneCelebration />
      </>
    );
  }

  // Marketing pages get Navbar + Footer with transitions
  return (
    <>
      <Navbar />
      <PageTransition>
        <main>{children}</main>
      </PageTransition>
      <Footer />
      <PWAInstall />
      <ServiceWorkerRegistration />
      <MilestoneCelebration />
    </>
  );
}
