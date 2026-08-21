export type MembershipRole = "admin" | "member" | "owner";

export interface UserSummary {
  createdAt: string;
  displayName: string | null;
  email: string;
  id: string;
  imageUrl: string | null;
  role: MembershipRole | null;
}

/** Public city directory — no email. */
export interface DirectoryMember {
  createdAt: string;
  displayName: string | null;
  id: string;
  imageUrl: string | null;
  role: MembershipRole | null;
}

export interface UserProfile extends UserSummary {
  isBanned: boolean;
  isSuperAdmin: boolean;
}

export interface PublicAuthor {
  id: string;
  imageUrl: string | null;
  name: string;
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

export interface InviteRecord {
  createdAt: string;
  displayName: string | null;
  email: string;
  hasSignedUp: boolean;
  id: string;
}

export interface ImportMemberInput {
  displayName?: string;
  email: string;
}

export interface ImportMemberResult {
  created: number;
  errors: { email: string; error: string }[];
  skipped: number;
  updated: number;
}

export interface EmailPreferences {
  eventReminders: boolean;
  likes: boolean;
  mentions: boolean;
  messages: boolean;
  replies: boolean;
  weeklyDigest: boolean;
}

export interface EmailPreferencesInput {
  eventReminders?: boolean;
  likes?: boolean;
  mentions?: boolean;
  messages?: boolean;
  replies?: boolean;
  weeklyDigest?: boolean;
}

export const EMAIL_PREF_DEFAULTS: EmailPreferences = {
  eventReminders: true,
  likes: false,
  mentions: true,
  messages: true,
  replies: true,
  weeklyDigest: true,
};
