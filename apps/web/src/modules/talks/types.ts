export type TalkSubmissionStatus = "pending" | "approved" | "declined";

export interface TalkSubmissionInput {
  bio?: string | null;
  city?: string | null;
  description?: string | null;
  email?: string | null;
  name?: string | null;
  title?: string | null;
}

export interface TalkDetail {
  bio: string | null;
  city: string | null;
  contentLocked: boolean;
  createdAt: string;
  deletedAt: string | null;
  description: string | null;
  email: string;
  id: string;
  name: string;
  slidesFileName: string | null;
  slidesLocked: boolean;
  slidesMimeType: string | null;
  slidesSize: number | null;
  slidesUrl: string | null;
  status: TalkSubmissionStatus;
  title: string;
  updatedAt: string;
  userId: string | null;
}

export interface TalkListOptions {
  includeDeleted?: boolean;
  status?: TalkSubmissionStatus;
}

export interface TalkLocksInput {
  contentLocked?: boolean;
  slidesLocked?: boolean;
}

export interface TalkPatch {
  bio?: string | null;
  city?: string | null;
  contentLocked?: boolean;
  deleted?: boolean;
  description?: string | null;
  email?: string;
  name?: string;
  slidesLocked?: boolean;
  status?: TalkSubmissionStatus;
  title?: string;
}

export interface SpeakerInput {
  bio?: string | null;
  company?: string | null;
  companyLogoUrl?: string | null;
  headshotUrl?: string | null;
  linkedinUrl?: string | null;
  name?: string | null;
  talkDescription?: string | null;
  talkDescriptionShort?: string | null;
  talkTitle?: string | null;
  title?: string | null;
  twitterHandle?: string | null;
  websiteUrl?: string | null;
}

export interface TalkComment {
  authorId: string;
  content: string;
  createdAt: string;
  id: string;
  submissionId: string;
  updatedAt: string;
}

export interface SpeakerDetail {
  bio: string | null;
  company: string | null;
  companyLogoUrl: string | null;
  createdAt: string;
  eventId: string;
  headshotUrl: string | null;
  id: string;
  linkedinUrl: string | null;
  name: string;
  order: number;
  submissionId: string | null;
  talkDescription: string | null;
  talkDescriptionShort: string | null;
  talkTitle: string | null;
  title: string | null;
  twitterHandle: string | null;
  updatedAt: string;
  websiteUrl: string | null;
}
