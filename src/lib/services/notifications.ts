/**
 * Notifications service — single entry point for all notification reads,
 * writes, and dispatchers. Wraps `src/lib/notifications.ts` so routes,
 * MCP tools, and other services never import that infra module directly.
 */

import {
  createBadgeNotification,
  createLikeNotification,
  createMentionNotification,
  createMessageNotification,
  createNotification,
  createReplyNotification,
} from "@/lib/notifications";
import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";

export {
  createBadgeNotification,
  createLikeNotification,
  createMentionNotification,
  createMessageNotification,
  createNotification,
  createReplyNotification,
};

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
}

export async function listNotifications(
  actor: ActorLike,
  { unreadOnly = false, limit = 20 }: ListNotificationsOptions = {},
) {
  const db = await getPrisma();
  const where: { userId: string; isRead?: boolean } = { userId: actor.id };
  if (unreadOnly) where.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({
      where: { userId: actor.id, isRead: false },
    }),
  ]);

  return { notifications, unreadCount };
}

export async function markAllRead(actor: ActorLike) {
  const db = await getPrisma();
  await db.notification.updateMany({
    where: { userId: actor.id, isRead: false },
    data: { isRead: true },
  });
  return { success: true };
}
