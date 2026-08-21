// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as connectionsRepo from "@/modules/connections/repositories/connectionsRepository";
import type {
  ConnectionItem,
  ConnectionStatus,
  ListConnectionsOptions,
} from "@/modules/connections/types";
import { createNotification } from "@/modules/notifications/services/notificationsService";
import type { Actor } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

const RESPOND_STATUSES = new Set<ConnectionStatus>(["accepted", "rejected"]);

export async function listConnections(
  store: TenantStore,
  actor: Actor,
  options: ListConnectionsOptions = {},
): Promise<Result<{ connections: ConnectionItem[] }>> {
  const status = options.status ?? "accepted";
  const filter = options.filter ?? "all";
  return ok({
    connections: await connectionsRepo.listConnections(store, actor.id, { filter, status }),
  });
}

export async function createConnection(
  store: TenantStore,
  actor: Actor,
  receiverId: string,
): Promise<Result<{ connection: ConnectionItem }>> {
  const target = receiverId.trim();
  if (!target) {
    return err("bad_request", 400, "Receiver ID is required");
  }
  if (target === actor.id) {
    return err("bad_request", 400, "Cannot connect with yourself");
  }
  const existing = await connectionsRepo.findPair(store, actor.id, target);
  if (existing) {
    return err("conflict", 409, "Connection already exists");
  }
  const created = await connectionsRepo.insertConnection(store, actor.id, target);
  if (!created.ok) {
    return created;
  }
  await createNotification(store, {
    message: `${actor.name || "Someone"} wants to connect with you`,
    title: "New connection request",
    type: "follow",
    userId: target,
  });
  return created;
}

export async function respondToConnection(
  store: TenantStore,
  actor: Actor,
  connectionId: string,
  status: ConnectionStatus,
): Promise<Result<{ connection: ConnectionItem }>> {
  if (!RESPOND_STATUSES.has(status)) {
    return err("bad_request", 400, "Invalid status. Must be 'accepted' or 'rejected'");
  }
  const conn = await connectionsRepo.findById(store, connectionId);
  if (!conn) {
    return err("not_found", 404, "Connection not found");
  }
  if (conn.receiverId !== actor.id) {
    return err("forbidden", 403, "Only the receiver can accept or reject a connection");
  }
  if (conn.status !== "pending") {
    return err("bad_request", 400, "Connection has already been processed");
  }
  const updated = await connectionsRepo.updateStatus(store, connectionId, status);
  if (!updated.ok) {
    return updated;
  }
  if (status === "accepted") {
    await createNotification(store, {
      message: `${actor.name || "Someone"} accepted your connection request`,
      title: "Connection accepted",
      type: "follow",
      userId: conn.requesterId,
    });
  }
  return updated;
}

export async function deleteConnectionById(
  store: TenantStore,
  actor: Actor,
  connectionId: string,
): Promise<Result<{ success: true }>> {
  const conn = await connectionsRepo.findById(store, connectionId);
  if (!conn) {
    return err("not_found", 404, "Connection not found");
  }
  if (conn.requesterId !== actor.id && conn.receiverId !== actor.id) {
    return err("forbidden", 403, "Not allowed");
  }
  return await connectionsRepo.deleteById(store, connectionId);
}

export async function deleteConnectionWith(
  store: TenantStore,
  actor: Actor,
  otherUserId: string,
): Promise<Result<{ success: true }>> {
  await connectionsRepo.deletePair(store, actor.id, otherUserId.trim());
  return ok({ success: true });
}
