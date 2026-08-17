export type MembershipRole = "admin" | "member" | "owner";

export interface UserSummary {
  createdAt: string;
  displayName: string | null;
  email: string;
  id: string;
  imageUrl: string | null;
  role: MembershipRole | null;
}

export interface UserProfile extends UserSummary {
  isBanned: boolean;
  isSuperAdmin: boolean;
}

export interface ListUsersOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface UserWrite {
  clerkUserId: string;
  displayName?: string | null;
  email: string;
  id?: string;
  imageUrl?: string | null;
}

export interface MembershipWrite {
  orgId: string;
  role?: MembershipRole;
  userId: string;
}
