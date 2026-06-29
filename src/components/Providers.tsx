"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";
import type { City } from "@/lib/cities";
import type { TenantConfig } from "@/lib/tenant-config";
import { CitiesProvider } from "./CitiesProvider";
import { OnlineStatusProvider } from "./OnlineStatusProvider";
import { TenantBaseProvider } from "./TenantBaseProvider";
import { TenantConfigProvider } from "./TenantConfigProvider";
import { ToastProvider } from "./ui/Toast";

function OnlineStatusWrapper({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  return (
    <OnlineStatusProvider isAuthenticated={isSignedIn ?? false}>{children}</OnlineStatusProvider>
  );
}

export default function Providers({
  children,
  tenantConfig,
  tenantId,
  tenantBase,
  cities,
}: {
  children: ReactNode;
  tenantConfig: TenantConfig;
  tenantId: string;
  /** "" for host-based tenancy, "/<slug>" for path-prefix — re-attached to in-tenant links. */
  tenantBase: string;
  cities: City[];
}) {
  return (
    <TenantConfigProvider config={tenantConfig} tenantId={tenantId}>
      <CitiesProvider cities={cities}>
        <TenantBaseProvider base={tenantBase}>
          <ClerkProvider>
            <ToastProvider>
              <OnlineStatusWrapper>{children}</OnlineStatusWrapper>
            </ToastProvider>
          </ClerkProvider>
        </TenantBaseProvider>
      </CitiesProvider>
    </TenantConfigProvider>
  );
}
