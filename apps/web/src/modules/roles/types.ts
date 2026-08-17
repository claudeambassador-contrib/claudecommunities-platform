import type { Permission } from "@/shared/auth/permissions";

export interface RoleInput {
  description?: string | null;
  name: string;
  permissions: unknown;
}

export interface RolePatch {
  description?: string | null;
  permissions?: unknown;
}

export interface RoleWrite {
  description: string | null;
  isSystem?: boolean;
  name: string;
  permissions: Permission[];
}

export interface RoleSummary {
  description: string | null;
  isSystem: boolean;
  name: string;
  permissions: Permission[];
  userCount: number;
}
