import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { hasPermission, type Permission } from "@/shared/auth/permissions";

const PermissionsContext = createContext<ReadonlySet<Permission>>(new Set());

export interface PermissionsProviderProps {
  children: ReactNode;
  permissions: readonly Permission[];
}

export function PermissionsProvider({
  children,
  permissions,
}: PermissionsProviderProps): ReactElement {
  const value = useMemo(() => new Set(permissions), [permissions]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function useCan(): (permission: Permission | Permission[]) => boolean {
  const granted = useContext(PermissionsContext);
  return (permission) => hasPermission(granted, permission);
}

export function usePermissionsSet(): ReadonlySet<Permission> {
  return useContext(PermissionsContext);
}

export interface CanProps {
  children: ReactNode;
  fallback?: ReactNode;
  permission: Permission | Permission[];
}

export function Can({ children, fallback = null, permission }: CanProps): ReactElement {
  const can = useCan();
  if (can(permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
