/**
 * Talk-submission service. A `TalkSubmission` is the user-owned record of
 * a talk idea: title, description, optional slides, comments thread, status
 * + two independent lock flags. An admin can promote one into a per-event
 * `Speaker` (see ./speakers.ts).
 *
 * Authorization model:
 *  - Submitting users own the row through `userId`. They can read + edit
 *    their own talks within the constraints of the lock flags.
 *  - Admins can read + edit any talk and bypass both locks (locks exist to
 *    stop the *user* from editing, not the admin).
 *  - `contentLocked` blocks user edits to title / description / bio / name
 *    / email / city. `slidesLocked` blocks user edits to the slides field.
 *    The two flags are independent so an admin can lock the talk content
 *    after delivery while leaving slides open for post-event publication.
 */

import { publishNotification } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { getNotificationEmailHtml, sendEmail } from "@/lib/resend";
import { isStorageUrl } from "@/lib/storage";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

/** "Admin override" for talks — held by anyone who can edit speakers. */
function isTalkAdmin(actor: ActorLike): boolean {
  return hasPermission(actor, "speakers.edit");
}

export type TalkSubmissionStatus = "pending" | "approved" | "declined";

const VALID_STATUSES: readonly TalkSubmissionStatus[] = ["pending", "approved", "declined"];

function serialize(s: {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  title: string;
  description: string | null;
  bio: string | null;
  city: string | null;
  slidesUrl: string | null;
  slidesFileName: string | null;
  slidesMimeType: string | null;
  slidesSize: number | null;
  status: string;
  contentLocked: boolean;
  slidesLocked: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    email: s.email,
    title: s.title,
    description: s.description,
    bio: s.bio,
    city: s.city,
    slidesUrl: s.slidesUrl,
    slidesFileName: s.slidesFileName,
    slidesMimeType: s.slidesMimeType,
    slidesSize: s.slidesSize,
    status: s.status,
    contentLocked: s.contentLocked,
    slidesLocked: s.slidesLocked,
    deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export type SerializedTalkSubmission = ReturnType<typeof serialize>;

export interface TalkSubmissionInput {
  name?: string | null;
  email?: string | null;
  /** Talk title (was `topic` on the old form). */
  title?: string | null;
  /** Long-form talk description, markdown supported. */
  description?: string | null;
  /** Speaker bio for this talk, markdown supported. */
  bio?: string | null;
  city?: string | null;
}

export interface SlidesInput {
  slidesUrl: string;
  slidesFileName?: string | null;
  slidesMimeType?: string | null;
  slidesSize?: number | null;
}

// ----- helpers -----

function requireOwnerOrAdmin(actor: ActorLike, ownerId: string | null): void {
  if (isTalkAdmin(actor)) return;
  if (ownerId && ownerId === actor.id) return;
  throw new ServiceError("forbidden", "Not allowed");
}

async function loadOrThrow(id: string) {
  const row = await (await getPrisma()).talkSubmission.findUnique({ where: { id } });
  if (!row) throw new ServiceError("not_found", "Talk submission not found");
  return row;
}

// ----- CREATE -----

export async function createTalkSubmission(actor: ActorLike, input: TalkSubmissionInput) {
  const name = (input.name ?? "").trim();
  if (!name) throw new ServiceError("bad_request", "Name is required");

  const email = (input.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new ServiceError("bad_request", "Valid email is required");

  const title = (input.title ?? "").trim();
  if (!title) throw new ServiceError("bad_request", "Talk title is required");

  const description = input.description?.trim() || null;
  const bio = input.bio?.trim() || null;
  const city = input.city?.trim() || null;

  const created = await (await getPrisma()).talkSubmission.create({
    data: { userId: actor.id, name, email, title, description, bio, city },
  });

  // Fire-and-forget admin notification. Email failures must not break submit.
  try {
    // User is global, but a talk belongs to ONE community — notify only admins
    // who are members of THIS tenant (the membership join), else a submission
    // in one community would email every other community's admins. (User.role
    // is the global identity role; per-tenant authz lives on the membership.)
    const tenantId = await getTenantId();
    const admins = await (await getPlatformPrisma()).user.findMany({
      where: { role: "admin", tenantMemberships: { some: { tenantId } } },
      select: { email: true },
    });
    const adminEmails = admins.map((a) => a.email).filter((e): e is string => !!e);
    const config = await getTenantConfig();
    if (adminEmails.length > 0) {
      const body = `<strong>${name}</strong> submitted a talk:<br/><br/><em>${title}</em>${
        description ? `<br/><br/>${description}` : ""
      }${city ? `<br/><br/>Preferred city: ${city}` : ""}${
        bio ? `<br/><br/>Bio: ${bio}` : ""
      }<br/><br/>Email: ${email}`;
      await sendEmail({
        to: adminEmails,
        subject: `New talk submission: ${name} — ${title}`,
        html: getNotificationEmailHtml(
          "Admin",
          "New talk submission",
          body,
          "/admin/speakers",
          config,
        ),
      });
    }
  } catch (err) {
    console.error("Failed to send admin notification:", err);
  }

  // Fire-and-forget Slack notification via the shared notifications queue.
  const baseUrl = (await getTenantConfig()).appUrl;
  publishNotification({
    type: "community.talk_submission.submitted",
    data: {
      id: created.id,
      name,
      title,
      email,
      description,
      city,
      manageUrl: `${baseUrl}/admin/speakers`,
    },
  });

  return serialize(created);
}

// ----- LIST -----

export async function listTalkSubmissions(
  actor: ActorLike,
  options: { status?: TalkSubmissionStatus; includeDeleted?: boolean } = {},
) {
  ensurePermission(actor, "speakers.edit");
  // Soft-deleted rows are hidden by default. The admin overview opts in with
  // `includeDeleted` so it can render its own "Deleted" tab; everything else
  // (MCP `listSpeakerSubmissions`, status-filtered queries) stays clean.
  const where = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.includeDeleted ? {} : { deletedAt: null }),
  };
  const rows = await (await getPrisma()).talkSubmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serialize);
}

export async function listUserTalks(actor: ActorLike) {
  // Filter by ownership only; admins use listTalkSubmissions for the full view.
  const rows = await (await getPrisma()).talkSubmission.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serialize);
}

export async function getTalk(actor: ActorLike, id: string) {
  const row = await loadOrThrow(id);
  requireOwnerOrAdmin(actor, row.userId);
  return serialize(row);
}

// ----- USER EDITS (respect contentLocked) -----

export async function updateTalkContent(actor: ActorLike, id: string, input: TalkSubmissionInput) {
  const row = await loadOrThrow(id);
  requireOwnerOrAdmin(actor, row.userId);
  if (row.contentLocked && !isTalkAdmin(actor)) {
    throw new ServiceError("forbidden", "This talk is locked for editing");
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const v = (input.name ?? "").trim();
    if (!v) throw new ServiceError("bad_request", "Name cannot be empty");
    data.name = v;
  }
  if (input.email !== undefined) {
    const v = (input.email ?? "").trim().toLowerCase();
    if (!v.includes("@")) throw new ServiceError("bad_request", "Valid email is required");
    data.email = v;
  }
  if (input.title !== undefined) {
    const v = (input.title ?? "").trim();
    if (!v) throw new ServiceError("bad_request", "Title cannot be empty");
    data.title = v;
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.bio !== undefined) data.bio = input.bio?.trim() || null;
  if (input.city !== undefined) data.city = input.city?.trim() || null;

  if (Object.keys(data).length === 0) return serialize(row);

  const updated = await (await getPrisma()).talkSubmission.update({ where: { id }, data });
  return serialize(updated);
}

// ----- SLIDES (respect slidesLocked) -----

export async function setTalkSlides(actor: ActorLike, id: string, slides: SlidesInput) {
  const row = await loadOrThrow(id);
  requireOwnerOrAdmin(actor, row.userId);
  if (row.slidesLocked && !isTalkAdmin(actor)) {
    throw new ServiceError("forbidden", "Slides are locked for this talk");
  }

  if (!isStorageUrl(slides.slidesUrl)) {
    throw new ServiceError("bad_request", "slidesUrl must be a storage URL");
  }

  const updated = await (await getPrisma()).talkSubmission.update({
    where: { id },
    data: {
      slidesUrl: slides.slidesUrl,
      slidesFileName: slides.slidesFileName ?? null,
      slidesMimeType: slides.slidesMimeType ?? null,
      slidesSize: slides.slidesSize ?? null,
    },
  });
  return serialize(updated);
}

export async function clearTalkSlides(actor: ActorLike, id: string) {
  const row = await loadOrThrow(id);
  requireOwnerOrAdmin(actor, row.userId);
  if (row.slidesLocked && !isTalkAdmin(actor)) {
    throw new ServiceError("forbidden", "Slides are locked for this talk");
  }
  const updated = await (await getPrisma()).talkSubmission.update({
    where: { id },
    data: {
      slidesUrl: null,
      slidesFileName: null,
      slidesMimeType: null,
      slidesSize: null,
    },
  });
  return serialize(updated);
}

// ----- ADMIN-ONLY -----

export async function setTalkStatus(actor: ActorLike, id: string, status: TalkSubmissionStatus) {
  ensurePermission(actor, "speakers.edit");
  if (!VALID_STATUSES.includes(status)) {
    throw new ServiceError("bad_request", "status must be pending, approved, or declined");
  }
  const updated = await (await getPrisma()).talkSubmission
    .update({ where: { id }, data: { status } })
    .catch(() => {
      throw new ServiceError("not_found", "Talk submission not found");
    });
  return serialize(updated);
}

export async function setTalkLocks(
  actor: ActorLike,
  id: string,
  locks: { contentLocked?: boolean; slidesLocked?: boolean },
) {
  ensurePermission(actor, "speakers.edit");
  const data: Record<string, unknown> = {};
  if (locks.contentLocked !== undefined) data.contentLocked = locks.contentLocked;
  if (locks.slidesLocked !== undefined) data.slidesLocked = locks.slidesLocked;
  if (Object.keys(data).length === 0) {
    throw new ServiceError("bad_request", "At least one lock flag is required");
  }
  const updated = await (await getPrisma()).talkSubmission
    .update({ where: { id }, data })
    .catch(() => {
      throw new ServiceError("not_found", "Talk submission not found");
    });
  return serialize(updated);
}

/**
 * Soft-delete (`deleted: true`) or restore (`deleted: false`) a talk
 * submission. Soft-deleted rows stay in the database but are hidden from
 * the default admin/MCP listings — they only surface in the admin "Deleted"
 * tab (via `listTalkSubmissions({ includeDeleted: true })`). Admin-only.
 */
export async function setTalkDeleted(actor: ActorLike, id: string, deleted: boolean) {
  ensurePermission(actor, "speakers.delete");
  const updated = await (await getPrisma()).talkSubmission
    .update({ where: { id }, data: { deletedAt: deleted ? new Date() : null } })
    .catch(() => {
      throw new ServiceError("not_found", "Talk submission not found");
    });
  return serialize(updated);
}

export async function deleteTalkSubmission(actor: ActorLike, id: string) {
  // Both admins and the owner can delete (the latter only if pending and not
  // locked — once a talk has been processed by admin, only admin can drop it).
  const row = await loadOrThrow(id);
  if (!isTalkAdmin(actor)) {
    if (row.userId !== actor.id) {
      throw new ServiceError("forbidden", "Not allowed");
    }
    if (row.status !== "pending" || row.contentLocked || row.slidesLocked) {
      throw new ServiceError(
        "forbidden",
        "Cannot delete a talk after it has been reviewed or locked",
      );
    }
  }
  await (await getPrisma()).talkSubmission.delete({ where: { id } });
  return { success: true };
}
