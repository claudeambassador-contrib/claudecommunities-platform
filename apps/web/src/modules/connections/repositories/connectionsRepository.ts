import { and, desc, eq, or } from "drizzle-orm";

import type {
  ConnectionItem,
  ConnectionListFilter,
  ConnectionStatus,
} from "@/modules/connections/types";
import { first } from "@/shared/db/rows";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type ConnectionsTables = Pick<TenantTables, "connections">;
const tables = (store: TenantStore): ConnectionsTables => store.tables;

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function toItem(row: {
  createdAt: Date;
  id: string;
  receiverId: string;
  requesterId: string;
  status: ConnectionStatus;
  updatedAt: Date;
}): ConnectionItem {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    receiverId: row.receiverId,
    requesterId: row.requesterId,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findPair(
  store: TenantStore,
  userA: string,
  userB: string,
): Promise<ConnectionItem | null> {
  const { connections } = tables(store);
  const row = first(
    await store.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.orgId, store.orgId),
          or(
            and(eq(connections.requesterId, userA), eq(connections.receiverId, userB)),
            and(eq(connections.requesterId, userB), eq(connections.receiverId, userA)),
          ),
        ),
      )
      .limit(1),
  );
  return row ? toItem(row) : null;
}

export async function findById(store: TenantStore, id: string): Promise<ConnectionItem | null> {
  const { connections } = tables(store);
  const row = first(
    await store.db
      .select()
      .from(connections)
      .where(and(eq(connections.orgId, store.orgId), eq(connections.id, id)))
      .limit(1),
  );
  return row ? toItem(row) : null;
}

export async function listConnections(
  store: TenantStore,
  actorId: string,
  options: { filter: ConnectionListFilter; status: ConnectionStatus },
): Promise<ConnectionItem[]> {
  const { connections } = tables(store);
  let party = or(eq(connections.requesterId, actorId), eq(connections.receiverId, actorId));
  if (options.filter === "sent") {
    party = eq(connections.requesterId, actorId);
  } else if (options.filter === "received") {
    party = eq(connections.receiverId, actorId);
  }
  const rows = await store.db
    .select()
    .from(connections)
    .where(and(eq(connections.orgId, store.orgId), eq(connections.status, options.status), party))
    .orderBy(desc(connections.updatedAt));
  return rows.map(toItem);
}

export async function insertConnection(
  store: TenantStore,
  requesterId: string,
  receiverId: string,
): Promise<Result<{ connection: ConnectionItem }>> {
  const { connections } = tables(store);
  const now = new Date();
  const id = newId("con");
  try {
    await store.db.insert(connections).values({
      createdAt: now,
      id,
      orgId: store.orgId,
      receiverId,
      requesterId,
      status: "pending",
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "Connection already exists");
    }
    throw error;
  }
  return ok({
    connection: {
      createdAt: now.toISOString(),
      id,
      receiverId,
      requesterId,
      status: "pending",
      updatedAt: now.toISOString(),
    },
  });
}

export async function updateStatus(
  store: TenantStore,
  id: string,
  status: ConnectionStatus,
): Promise<Result<{ connection: ConnectionItem }>> {
  const { connections } = tables(store);
  await store.db
    .update(connections)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(connections.orgId, store.orgId), eq(connections.id, id)));
  const updated = await findById(store, id);
  if (!updated) {
    return err("not_found", 404, "Connection not found");
  }
  return ok({ connection: updated });
}

export async function deleteById(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const { connections } = tables(store);
  await store.db
    .delete(connections)
    .where(and(eq(connections.orgId, store.orgId), eq(connections.id, id)));
  return ok({ success: true });
}

export async function deletePair(store: TenantStore, userA: string, userB: string): Promise<void> {
  const { connections } = tables(store);
  await store.db
    .delete(connections)
    .where(
      and(
        eq(connections.orgId, store.orgId),
        or(
          and(eq(connections.requesterId, userA), eq(connections.receiverId, userB)),
          and(eq(connections.requesterId, userB), eq(connections.receiverId, userA)),
        ),
      ),
    );
}
