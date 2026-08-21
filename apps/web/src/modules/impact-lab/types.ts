export const PARTICIPANT_ROLES = ["judge", "mentor", "participant"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export interface InterestInput {
  email: string;
  name?: string;
}

export interface SponsorSummary {
  id: string;
  name: string;
  website: string | null;
}

export interface PublicConfig {
  checkInOpen: boolean;
  coffeeNote: string;
  eventDate: string;
  eventName: string;
  eventTagline: string;
  peoplesChoiceOpen: boolean;
  peoplesChoiceWinnerTeamId: string | null;
  votingOpen: boolean;
  winningStatementId: string | null;
}

export interface ConfigRow extends PublicConfig {
  accessCode: string;
  adminPassword: string;
  adminToken: string | null;
  id: string;
}

export interface CheckInInput {
  code: string;
  email: string;
  name: string;
  teamId?: string;
}

export interface ParticipantDetail {
  checkedIn: boolean;
  checkedInAt: string | null;
  coffeeCode: string;
  coffeeRedeemed: boolean;
  coffeeRedeemedAt: string | null;
  email: string;
  id: string;
  name: string;
  role: ParticipantRole;
  teamId: string | null;
}

export interface ParticipantWrite {
  checkedIn?: boolean;
  checkedInAt?: Date | null;
  email: string;
  name: string;
  preRegistered?: boolean;
  role?: ParticipantRole;
  sessionToken?: string | null;
  teamId?: string | null;
}

export interface TeamInput {
  color?: string;
  name?: string;
  tableNumber?: string | null;
}

export interface TeamDetail {
  color: string;
  conceptRepoUrl: string | null;
  conceptSubmittedAt: string | null;
  conceptSummary: string | null;
  conceptTitle: string | null;
  id: string;
  name: string;
  tableNumber: string | null;
}

export interface StatementDetail {
  description: string;
  id: string;
  sortOrder: number;
  summary: string;
  title: string;
}

export interface SettingsInput {
  accessCode?: string;
  adminPassword?: string;
  checkInOpen?: boolean;
  coffeeNote?: string;
  eventDate?: string;
  eventName?: string;
  eventTagline?: string;
  peoplesChoiceOpen?: boolean;
  peoplesChoiceWinnerTeamId?: string | null;
  votingOpen?: boolean;
  winningStatementId?: string | null;
}

export interface CoffeePoolStatus {
  assigned: number;
  redeemed: number;
  total: number;
  unassigned: number;
}

export interface ConfigWrite {
  accessCode?: string;
  adminPassword?: string;
  adminToken?: string | null;
  checkInOpen?: boolean;
  coffeeNote?: string;
  eventDate?: string;
  eventName?: string;
  eventTagline?: string;
  peoplesChoiceOpen?: boolean;
  peoplesChoiceWinnerTeamId?: string | null;
  votingOpen?: boolean;
  winningStatementId?: string | null;
}
