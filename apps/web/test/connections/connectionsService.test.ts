import { describe, expect, it } from "vitest";

import {
  createConnection,
  deleteConnectionById,
  listConnections,
  respondToConnection,
} from "@/modules/connections/services/connectionsService";

import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("connectionsService", () => {
  it("creates a pending request, lets only the receiver accept, and lists accepted", async () => {
    const store = openMemoryTenant();
    const ada = memberActor();
    const al = adminActor({ id: "usr_al", name: "Al" });

    const self = await createConnection(store, ada, ada.id);
    expect(self.ok).toBeFalsy();

    const created = await createConnection(store, ada, al.id);
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.connection.status).toBe("pending");

    const dup = await createConnection(store, al, ada.id);
    expect(dup.ok).toBeFalsy();
    if (!dup.ok) {
      expect(dup.error.status).toBe(409);
    }

    const requesterAccept = await respondToConnection(
      store,
      ada,
      created.connection.id,
      "accepted",
    );
    expect(requesterAccept.ok).toBeFalsy();

    const accepted = await respondToConnection(store, al, created.connection.id, "accepted");
    expect(accepted.ok).toBeTruthy();

    const listed = await listConnections(store, ada, { status: "accepted" });
    expect(listed.ok).toBeTruthy();
    if (listed.ok) {
      expect(listed.connections).toHaveLength(1);
    }

    const stranger = await deleteConnectionById(
      store,
      memberActor({ id: "usr_other" }),
      created.connection.id,
    );
    expect(stranger.ok).toBeFalsy();
    const removed = await deleteConnectionById(store, ada, created.connection.id);
    expect(removed.ok).toBeTruthy();
  });
});
