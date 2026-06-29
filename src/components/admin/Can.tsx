"use client";

import { createContext, useContext, useMemo } from "react";
import type { Permission } from "@/lib/permissions";

const PermissionsContext = createContext<ReadonlySet<Permission>>(new Set());

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly Permission[];
  children: React.ReactNode;
}) {
  const value = useMemo(() => new Set(permissions), [permissions]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function useCan(): (permission: Permission | Permission[]) => boolean {
  const set = useContext(PermissionsContext);
  return (permission) => {
    const required = Array.isArray(permission) ? permission : [permission];
    return required.every((p) => set.has(p));
  };
}

export function usePermissionsSet(): ReadonlySet<Permission> {
  return useContext(PermissionsContext);
}

/**
 * Renders `children` only when the current user has every permission in
 * `permission` (string or array). Pass `fallback` to show something else
 * when the permission is missing.
 *
 * Permissions are read from the nearest `<PermissionsProvider>` ancestor
 * (provided by `AdminShell`).
 */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission | Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const can = useCan();
  return <>{can(permission) ? children : fallback}</>;
}
