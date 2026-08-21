export type NotificationType =
  | "badge"
  | "comment"
  | "follow"
  | "like"
  | "mention"
  | "message"
  | "reply";

export interface NotificationPayload {
  link?: string | null;
  message: string;
  title: string;
}

export interface NotificationWrite {
  payload: NotificationPayload;
  type: NotificationType;
  userId: string;
}

export interface NotificationItem {
  createdAt: string;
  id: string;
  payload: NotificationPayload;
  readAt: string | null;
  type: string;
  userId: string;
}

export interface ListNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
}
