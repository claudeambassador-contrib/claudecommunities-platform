import type { EmailPreference } from "@prisma/client";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { getNotificationEmailHtml, sendEmail } from "@/lib/resend";
import { stripMarkdown } from "@/lib/strip-markdown";
import { getTenantConfig } from "@/lib/tenant-config";

interface CreateNotificationParams {
  userId: string;
  type: "mention" | "reply" | "like" | "comment" | "badge" | "message" | "follow";
  title: string;
  message: string;
  link?: string;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams) {
  try {
    // Notification is tenant-scoped (getPrisma stamps tenantId); EmailPreference
    // is global-per-user (getPlatformPrisma). Both are needed here.
    const db = await getPrisma();
    const platform = await getPlatformPrisma();
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
      },
    });

    // Check if user wants email notifications for this type
    const emailPrefs = await platform.emailPreference.findUnique({
      where: { userId },
    });

    // Default to sending emails if no preferences exist
    const shouldSendEmail = !emailPrefs || shouldNotifyByEmail(type, emailPrefs);

    if (shouldSendEmail) {
      // Queue email notification
      await queueEmailNotification(notification.id, userId, type, title, message, link);
    }

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
}

function shouldNotifyByEmail(type: string, prefs: EmailPreference): boolean {
  switch (type) {
    case "mention":
      return prefs.mentions;
    case "reply":
      return prefs.replies;
    case "like":
      return prefs.likes;
    case "message":
      return prefs.messages;
    default:
      return true;
  }
}

async function queueEmailNotification(
  notificationId: string,
  userId: string,
  _type: string,
  title: string,
  message: string,
  link?: string,
) {
  // Get user email (User is global identity → platform client)
  const platform = await getPlatformPrisma();
  const user = await platform.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) return;

  // Generate email HTML and send via Resend
  const config = await getTenantConfig();
  const html = getNotificationEmailHtml(user.name || "there", title, message, link, config);

  const result = await sendEmail({
    to: user.email,
    subject: title,
    html,
  });

  if (result.success) {
    // Mark as email sent (Notification is tenant-scoped → scoped client)
    const db = await getPrisma();
    await db.notification.update({
      where: { id: notificationId },
      data: { emailSent: true },
    });
  } else {
    console.error("Failed to send notification email:", result.error);
  }
}

export async function createMentionNotification(
  mentionedUserId: string,
  mentionerName: string,
  postId: string,
  contentPreview: string,
) {
  const plain = stripMarkdown(contentPreview);
  return createNotification({
    userId: mentionedUserId,
    type: "mention",
    title: `${mentionerName} mentioned you`,
    message: plain.substring(0, 100) + (plain.length > 100 ? "..." : ""),
    link: `/community/posts/${postId}`,
  });
}

export async function createReplyNotification(
  postAuthorId: string,
  replierName: string,
  postId: string,
  replyPreview: string,
) {
  const plain = stripMarkdown(replyPreview);
  return createNotification({
    userId: postAuthorId,
    type: "reply",
    title: `${replierName} replied to your post`,
    message: plain.substring(0, 100) + (plain.length > 100 ? "..." : ""),
    link: `/community/posts/${postId}`,
  });
}

export async function createLikeNotification(
  postAuthorId: string,
  likerName: string,
  postId: string,
  postTitle?: string,
) {
  return createNotification({
    userId: postAuthorId,
    type: "like",
    title: `${likerName} liked your post`,
    message: postTitle || "Your post received a like",
    link: `/community/posts/${postId}`,
  });
}

export async function createMessageNotification(
  recipientId: string,
  senderName: string,
  messagePreview: string,
) {
  const { discordCommunityInvite } = await getTenantConfig();
  return createNotification({
    userId: recipientId,
    type: "message",
    title: `New message from ${senderName}`,
    message: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? "..." : ""),
    link: discordCommunityInvite,
  });
}

export async function createBadgeNotification(userId: string, badgeName: string) {
  return createNotification({
    userId,
    type: "badge",
    title: "You earned a badge!",
    message: `Congratulations! You've earned the "${badgeName}" badge.`,
    link: `/community/profile/${userId}`,
  });
}
