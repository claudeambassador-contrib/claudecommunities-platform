"use client";

/**
 * Client-side tenant link base — the client successor to `getTenantBase()`.
 *
 * The root layout resolves the base ("" host-based, "/<slug>" path-prefix) once
 * on the server and seeds it here; client components read it synchronously and
 * build tenant-correct links via `<TenantLink>` / `useTenantRouter()`, which
 * apply `tenantHref()`. In every host-based mode the base is "" so these are
 * exact drop-ins for `<Link>` / `useRouter()`. See `@/lib/tenant-base`.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, createContext, type ReactNode, useContext, useMemo } from "react";
import { tenantHref } from "@/lib/tenant-base";

const TenantBaseContext = createContext<string>("");

export function TenantBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <TenantBaseContext.Provider value={base}>{children}</TenantBaseContext.Provider>;
}

/** The current tenant link base ("" host-based, "/<slug>" path-prefix). */
export function useTenantBase(): string {
  return useContext(TenantBaseContext);
}

/**
 * `next/link` that re-attaches the path-prefix `/<slug>` to a root-absolute
 * in-tenant href — the drop-in for `<Link>` inside `app/t/[tenant]/**`. Host-based
 * tenancy → base "" → exactly `<Link>`. External / flat-platform / already-prefixed
 * hrefs are passed through untouched (see `tenantHref`). `href` is string-only;
 * for the rare `UrlObject` href, compose the string and pass it here.
 */
export function TenantLink({
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const base = useTenantBase();
  return <Link href={tenantHref(base, href)} {...rest} />;
}

/**
 * `useRouter()` whose `push`/`replace`/`prefetch` re-attach the tenant base, for
 * programmatic navigation inside `app/t/[tenant]/**`. `back`/`forward`/`refresh`
 * pass through. Host-based tenancy → base "" → identical to `useRouter()`.
 */
export function useTenantRouter() {
  const router = useRouter();
  const base = useTenantBase();
  return useMemo(
    () => ({
      push: (href: string, opts?: Parameters<typeof router.push>[1]) =>
        router.push(tenantHref(base, href), opts),
      replace: (href: string, opts?: Parameters<typeof router.replace>[1]) =>
        router.replace(tenantHref(base, href), opts),
      prefetch: (href: string) => router.prefetch(tenantHref(base, href)),
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
    }),
    [router, base],
  );
}
