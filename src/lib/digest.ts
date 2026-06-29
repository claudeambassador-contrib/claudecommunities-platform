import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { stripMarkdown } from "@/lib/strip-markdown";
import { runWithTenant } from "@/lib/tenant-context";

interface DigestData {
  newPosts: {
    id: string;
    title: string | null;
    content: string;
    authorName: string;
    likesCount: number;
    commentsCount: number;
  }[];
  topPosts: {
    id: string;
    title: string | null;
    content: string;
    authorName: string;
    likesCount: number;
    commentsCount: number;
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    startTime: Date;
    location: string | null;
  }[];
  newCourses: {
    id: string;
    title: string;
    description: string | null;
  }[];
  stats: {
    newMembers: number;
    totalPosts: number;
    totalComments: number;
  };
}

export async function generateDigestForUser(userId: string): Promise<DigestData | null> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // EmailPreference is global-per-user (userId @unique) — read via the platform
  // client, consistent with notifications.ts. (It's classified tenant-scoped in
  // tenant-models.ts but keyed globally; a tracked schema tension — making it
  // truly per-tenant would need @@unique([tenantId, userId]).)
  const platform = await getPlatformPrisma();
  const emailPrefs = await platform.emailPreference.findUnique({
    where: { userId },
  });

  if (emailPrefs && !emailPrefs.weeklyDigest) {
    return null;
  }

  // Everything below is the CURRENT tenant's content (scoped client). Resolved
  // from runWithTenant in the cron loop, or the request header in the preview.
  const db = await getPrisma();

  // Get new posts from the past week
  const newPosts = await db.post.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
      authorId: { not: userId }, // Don't include user's own posts
    },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  // Get top posts (most liked) from the past week
  const topPosts = await db.post.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
    },
    take: 5,
    orderBy: { likes: { _count: "desc" } },
    include: {
      author: { select: { name: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  // Get upcoming events
  const upcomingEvents = await db.event.findMany({
    where: {
      isActive: true,
      startTime: { gte: now },
    },
    take: 3,
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      title: true,
      startTime: true,
      location: true,
    },
  });

  // Get new courses
  const newCourses = await db.course.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
      isPublished: true,
    },
    take: 3,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
    },
  });

  // Get stats (all scoped to THIS tenant). newMembers counts UserTenant rows —
  // people who JOINED this community this week — not the global User.count this
  // was before (which would have shown every tenant the platform-wide signups).
  const [newMembers, totalPosts, totalComments] = await Promise.all([
    db.userTenant.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    db.post.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    db.comment.count({ where: { createdAt: { gte: oneWeekAgo } } }),
  ]);

  return {
    newPosts: newPosts.map((p) => {
      const plain = stripMarkdown(p.content);
      return {
        id: p.id,
        title: p.title,
        content: plain.substring(0, 150) + (plain.length > 150 ? "..." : ""),
        authorName: p.author.name || "Anonymous",
        likesCount: p._count.likes,
        commentsCount: p._count.comments,
      };
    }),
    topPosts: topPosts.map((p) => {
      const plain = stripMarkdown(p.content);
      return {
        id: p.id,
        title: p.title,
        content: plain.substring(0, 150) + (plain.length > 150 ? "..." : ""),
        authorName: p.author.name || "Anonymous",
        likesCount: p._count.likes,
        commentsCount: p._count.comments,
      };
    }),
    upcomingEvents,
    newCourses,
    stats: {
      newMembers,
      totalPosts,
      totalComments,
    },
  };
}

export function generateDigestHtml(data: DigestData, userName: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Claude Code Community Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #2D2926; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #D4836A 0%, #c4775f 100%); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { padding: 24px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 600; color: #D4836A; margin: 0 0 16px; }
    .stat-grid { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat { background: #1C1917; border-radius: 12px; padding: 16px; flex: 1; min-width: 100px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: white; }
    .stat-label { font-size: 12px; color: #78716C; margin-top: 4px; }
    .post { background: #1C1917; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .post-title { font-weight: 600; color: white; margin: 0 0 4px; }
    .post-meta { font-size: 13px; color: #78716C; margin-bottom: 8px; }
    .post-content { font-size: 14px; color: #A8A29E; line-height: 1.5; }
    .post-stats { display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: #78716C; }
    .event { background: #1C1917; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .event-title { font-weight: 600; color: white; margin: 0 0 8px; }
    .event-details { font-size: 14px; color: #A8A29E; }
    .course { background: #1C1917; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .course-title { font-weight: 600; color: white; margin: 0 0 4px; }
    .course-desc { font-size: 14px; color: #A8A29E; }
    .cta { display: block; background: #D4836A; color: white; text-align: center; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 24px; }
    .cta:hover { background: #c4775f; }
    .footer { padding: 24px; text-align: center; font-size: 13px; color: #78716C; border-top: 1px solid rgba(255,255,255,0.06); }
    .footer a { color: #D4836A; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Digest</h1>
      <p>Hey ${userName}, here's what happened this week</p>
    </div>

    <div class="content">
      <div class="section">
        <h2 class="section-title">This Week's Stats</h2>
        <div class="stat-grid">
          <div class="stat">
            <div class="stat-value">${data.stats.newMembers}</div>
            <div class="stat-label">New Members</div>
          </div>
          <div class="stat">
            <div class="stat-value">${data.stats.totalPosts}</div>
            <div class="stat-label">Posts</div>
          </div>
          <div class="stat">
            <div class="stat-value">${data.stats.totalComments}</div>
            <div class="stat-label">Comments</div>
          </div>
        </div>
      </div>

      ${
        data.topPosts.length > 0
          ? `
      <div class="section">
        <h2 class="section-title">Top Posts</h2>
        ${data.topPosts
          .slice(0, 3)
          .map(
            (post) => `
          <div class="post">
            <p class="post-title">${post.title || "Untitled"}</p>
            <p class="post-meta">by ${post.authorName}</p>
            <p class="post-content">${post.content}</p>
            <div class="post-stats">
              <span>${post.likesCount} likes</span>
              <span>${post.commentsCount} comments</span>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        data.upcomingEvents.length > 0
          ? `
      <div class="section">
        <h2 class="section-title">Upcoming Events</h2>
        ${data.upcomingEvents
          .map(
            (event) => `
          <div class="event">
            <p class="event-title">${event.title}</p>
            <p class="event-details">
              ${new Date(event.startTime).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
              ${event.location ? ` • ${event.location}` : ""}
            </p>
          </div>
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        data.newCourses.length > 0
          ? `
      <div class="section">
        <h2 class="section-title">New Courses</h2>
        ${data.newCourses
          .map(
            (course) => `
          <div class="course">
            <p class="course-title">${course.title}</p>
            <p class="course-desc">${course.description ? stripMarkdown(course.description) : "Start learning today!"}</p>
          </div>
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      <a href="${baseUrl}/community" class="cta">Visit the Community</a>
    </div>

    <div class="footer">
      <p>You're receiving this because you're subscribed to weekly digests.</p>
      <p><a href="${baseUrl}/community/settings/notifications">Manage email preferences</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendDigestEmails() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Every ACTIVE community runs its own weekly digest. A person in N communities
  // gets N digests — each containing only that community's content — so we loop
  // tenants and re-establish each tenant's scope before resolving its members
  // and content. (Was a single global pass that emailed every user one digest
  // of ALL content, ignoring tenant boundaries.)
  const platform = await getPlatformPrisma();
  const tenants = await platform.tenant.findMany({
    where: { status: "active" },
    select: { slug: true },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const { slug } of tenants) {
    await runWithTenant(slug, async () => {
      const db = await getPrisma();
      // Per-tenant weekly cadence gate (DigestLog is scoped to this tenant).
      const recentDigest = await db.digestLog.findFirst({
        where: { sentAt: { gte: oneWeekAgo } },
      });
      if (recentDigest) {
        console.warn(`Digest already sent this week for tenant ${slug}, skipping...`);
        return;
      }

      // Members of THIS tenant who could receive a digest. User is global, so
      // the membership join is what scopes the recipient list to this community
      // (the chokepoint can't auto-scope User); the per-user weekly-digest
      // opt-out is enforced inside generateDigestForUser.
      const members = await platform.user.findMany({
        where: {
          isBanned: false,
          email: { not: null },
          tenantMemberships: { some: { tenantId: slug } },
        },
        select: { id: true, name: true, email: true },
      });

      for (const member of members) {
        try {
          const digestData = await generateDigestForUser(member.id);
          if (!digestData) continue;

          // Skip if there's nothing to report
          if (
            digestData.newPosts.length === 0 &&
            digestData.topPosts.length === 0 &&
            digestData.upcomingEvents.length === 0 &&
            digestData.newCourses.length === 0
          ) {
            continue;
          }

          const html = generateDigestHtml(digestData, member.name || "there");

          const result = await sendEmail({
            // biome-ignore lint/style/noNonNullAssertion: members query filters `email: { not: null }`, so email is provably non-null here
            to: member.email!,
            subject: "Your Weekly Claude Code Community Digest",
            html,
          });

          if (result.success) {
            sent++;
          } else {
            errors.push(`Failed to send to ${member.email} (${slug}): ${result.error}`);
          }
        } catch (error) {
          errors.push(`Failed to send to ${member.email} (${slug}): ${error}`);
        }
      }
    });
  }

  // Note: DigestLog is tracked per-user when individual digests are sent;
  // aggregate per-tenant logging could be added to gate the cadence above.

  return { sent, errors };
}
