/**
 * Connection requests between users.
 */
import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";
import { createNotification } from "./notifications";

export type ConnectionStatus = "pending" | "accepted" | "rejected";
export type ListFilter = "all" | "sent" | "received";

export interface ConnectionDTO {
  id: string;
  status: string;
  requesterId: string;
  receiverId: string;
  createdAt: string;
  updatedAt: string;
  requesterName: string | null;
  requesterImage: string | null;
  requesterRole: string | null;
  receiverName: string | null;
  receiverImage: string | null;
  receiverRole: string | null;
}

function toDTO(c: {
  id: string;
  status: string;
  requesterId: string;
  receiverId: string;
  createdAt: Date;
  updatedAt: Date;
  requester: { name: string | null; image: string | null; role: string };
  receiver: { name: string | null; image: string | null; role: string };
}): ConnectionDTO {
  return {
    id: c.id,
    status: c.status,
    requesterId: c.requesterId,
    receiverId: c.receiverId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    requesterName: c.requester.name,
    requesterImage: c.requester.image,
    requesterRole: c.requester.role,
    receiverName: c.receiver.name,
    receiverImage: c.receiver.image,
    receiverRole: c.receiver.role,
  };
}

export async function listConnections(
  actor: ActorLike,
  { status = "accepted", filter = "all" }: { status?: string; filter?: ListFilter } = {},
): Promise<ConnectionDTO[]> {
  const db = await getPrisma();
  const where: Record<string, unknown> = { status };
  if (filter === "sent") where.requesterId = actor.id;
  else if (filter === "received") where.receiverId = actor.id;
  else where.OR = [{ requesterId: actor.id }, { receiverId: actor.id }];

  const rows = await db.connection.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      requester: { select: { name: true, image: true, role: true } },
      receiver: { select: { name: true, image: true, role: true } },
    },
  });
  return rows.map(toDTO);
}

export async function createConnection(actor: ActorLike, receiverId: string) {
  const db = await getPrisma();
  if (!receiverId) throw new ServiceError("bad_request", "Receiver ID is required");
  if (receiverId === actor.id) {
    throw new ServiceError("bad_request", "Cannot connect with yourself");
  }

  const existing = await db.connection.findFirst({
    where: {
      OR: [
        { requesterId: actor.id, receiverId },
        { requesterId: receiverId, receiverId: actor.id },
      ],
    },
    select: { id: true, status: true },
  });
  if (existing) {
    throw new ServiceError("conflict", "Connection already exists", { status: existing.status });
  }

  const requester = await db.user.findUnique({
    where: { id: actor.id },
    select: { name: true },
  });

  const conn = await db.connection.create({
    data: { requesterId: actor.id, receiverId, status: "pending" },
  });

  await createNotification({
    userId: receiverId,
    type: "follow",
    title: "New connection request",
    message: `${requester?.name || "Someone"} wants to connect with you`,
    link: "/community/connections?tab=pending",
  });

  return {
    id: conn.id,
    requesterId: actor.id,
    receiverId,
    status: "pending",
    createdAt: conn.createdAt.toISOString(),
  };
}

export async function respondToConnection(
  actor: ActorLike,
  connectionId: string,
  status: ConnectionStatus,
) {
  const db = await getPrisma();
  if (!["accepted", "rejected"].includes(status)) {
    throw new ServiceError("bad_request", "Invalid status. Must be 'accepted' or 'rejected'");
  }

  const conn = await db.connection.findUnique({
    where: { id: connectionId },
    include: { receiver: { select: { name: true } } },
  });
  if (!conn) throw new ServiceError("not_found", "Connection not found");
  if (conn.receiverId !== actor.id) {
    throw new ServiceError("forbidden", "Only the receiver can accept or reject a connection");
  }
  if (conn.status !== "pending") {
    throw new ServiceError("bad_request", "Connection has already been processed");
  }

  const updated = await db.connection.update({
    where: { id: connectionId },
    data: { status },
  });

  if (status === "accepted") {
    await createNotification({
      userId: conn.requesterId,
      type: "follow",
      title: "Connection accepted",
      message: `${conn.receiver?.name || "Someone"} accepted your connection request`,
      link: "/community/connections",
    });
  }

  return { id: connectionId, status, updatedAt: updated.updatedAt.toISOString() };
}

export async function deleteConnectionById(actor: ActorLike, connectionId: string) {
  const db = await getPrisma();
  const conn = await db.connection.findUnique({
    where: { id: connectionId },
    select: { requesterId: true, receiverId: true },
  });
  if (!conn) throw new ServiceError("not_found", "Connection not found");
  if (conn.requesterId !== actor.id && conn.receiverId !== actor.id) {
    throw new ServiceError("forbidden", "Not allowed");
  }
  await db.connection.delete({ where: { id: connectionId } });
  return { success: true };
}

export async function deleteConnectionWith(actor: ActorLike, otherUserId: string) {
  const db = await getPrisma();
  await db.connection.deleteMany({
    where: {
      OR: [
        { requesterId: actor.id, receiverId: otherUserId },
        { requesterId: otherUserId, receiverId: actor.id },
      ],
    },
  });
  return { success: true };
}
