/**
 * Activity + points service.
 *
 * Previously duplicated across `/api/posts/route.ts` (create post) and
 * `lib/mcp/tools.ts createPost`. Other future call sites (comments, RSVPs,
 * enrolments, etc.) should call these helpers rather than re-implementing
 * the insert + UPDATE + level-up sequence.
 */
import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { generateId } from "./_ids";

export type ActivityType = "post_created" | "comment_created" | "event_rsvp" | "course_enrolled";

export interface RecordActivityInput {
  userId: string;
  type: ActivityType | string;
  data?: Record<string, unknown>;
}

/**
 * Inserts an Activity row. Failures are swallowed (best-effort) to match the
 * existing call-site behaviour where activity logging was wrapped in
 * try/catch and never blocked the primary write.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  const db = await getPrisma();
  try {
    await db.activity.create({
      data: {
        id: generateId("activity"),
        type: input.type,
        data: input.data ? JSON.stringify(input.data) : null,
        userId: input.userId,
      },
    });
  } catch (e) {
    console.error("recordActivity failed:", e);
  }
}

const POINTS_PER_LEVEL = 100;

/**
 * Increments the user's points by `n` and bumps `level` if a new
 * `POINTS_PER_LEVEL`-point threshold is crossed.
 *
 * Best-effort — failures are logged, not thrown, to keep activity bookkeeping
 * non-fatal to the primary write.
 */
export interface ListActivityOptions {
  limit?: number;
  offset?: number;
  userId?: string;
}

export interface ActivityDTO {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null; role: string | null };
}

export async function listActivity(
  _actor: ActorLike,
  { limit = 20, offset = 0, userId }: ListActivityOptions = {},
): Promise<ActivityDTO[]> {
  const db = await getPrisma();
  const rows = await db.activity.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: { user: { select: { id: true, name: true, image: true, role: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    type: a.type,
    data: a.data ? JSON.parse(a.data) : null,
    createdAt: a.createdAt.toISOString(),
    user: a.user,
  }));
}

export async function awardPoints(userId: string, n: number): Promise<void> {
  const db = await getPrisma();
  try {
    const updated = await db.user.update({
      where: { id: userId },
      data: { points: { increment: n } },
      select: { points: true, level: true },
    });
    const newLevel = Math.floor(updated.points / POINTS_PER_LEVEL) + 1;
    if (newLevel > updated.level) {
      await db.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });
    }
  } catch (e) {
    console.error("awardPoints failed:", e);
  }
}
