export type ActivityType = "comment_created" | "course_enrolled" | "event_rsvp" | "post_created";

export interface RecordActivityInput {
  data?: Record<string, unknown>;
  type: ActivityType | string;
  userId: string;
}

export interface ListActivityOptions {
  limit?: number;
  offset?: number;
  userId?: string;
}

export interface ActivityItem {
  createdAt: string;
  data: unknown;
  id: string;
  type: string;
  userId: string;
}
