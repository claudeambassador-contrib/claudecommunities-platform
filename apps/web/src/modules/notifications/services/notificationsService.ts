// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as notificationsRepo from "@/modules/notifications/repositories/notificationsRepository";
import type {
  ListNotificationsOptions,
  NotificationItem,
  NotificationPayload,
  NotificationType,
} from "@/modules/notifications/types";
import type { Actor } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

const TYPES = new Set<NotificationType>([
  "badge",
  "comment",
  "follow",
  "like",
  "mention",
  "message",
  "reply",
]);

function clampLimit(limit?: number): number {
  return Math.min(100, Math.max(1, limit ?? 20));
}

export async function listNotifications(
  store: TenantStore,
  actor: Actor,
  options: ListNotificationsOptions = {},
): Promise<Result<{ notifications: NotificationItem[]; unreadCount: number }>> {
  const unreadOnly = Boolean(options.unreadOnly);
  const [notifications, unreadCount] = await Promise.all([
    notificationsRepo.listForUser(store, actor.id, {
      limit: clampLimit(options.limit),
      unreadOnly,
    }),
    notificationsRepo.countUnread(store, actor.id),
  ]);
  return ok({ notifications, unreadCount });
}

export async function markAllRead(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ success: true }>> {
  await notificationsRepo.markAllRead(store, actor.id);
  return ok({ success: true });
}

export async function createNotification(
  store: TenantStore,
  input: { link?: string | null; message: string; title: string; type: string; userId: string },
): Promise<Result<{ notification: NotificationItem }>> {
  if (!input.userId.trim()) {
    return err("bad_request", 400, "userId is required");
  }
  const title = input.title.trim();
  const message = input.message.trim();
  if (!(title && message)) {
    return err("bad_request", 400, "title and message are required");
  }
  if (!TYPES.has(input.type as NotificationType)) {
    return err("bad_request", 400, "Unknown notification type");
  }
  const payload: NotificationPayload = {
    link: input.link?.trim() || null,
    message,
    title,
  };
  return ok({
    notification: await notificationsRepo.insertNotification(store, {
      payload,
      type: input.type as NotificationType,
      userId: input.userId.trim(),
    }),
  });
}
