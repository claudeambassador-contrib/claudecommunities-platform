import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { ServiceError } from "@/lib/services/_errors";
import { withService } from "@/lib/services/_route";
import {
  type ConnectionStatus,
  createConnection,
  deleteConnectionById,
  deleteConnectionWith,
  type ListFilter,
  listConnections,
  respondToConnection,
} from "@/lib/services/connections";

export const GET = withService(async (request) => {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "accepted";
  const filter = (searchParams.get("type") || "all") as ListFilter;
  return NextResponse.json(await listConnections(user, { status, filter }));
});

export const POST = withService(async (request) => {
  const user = await requireSessionUser();
  const { receiverId } = await request.json();
  return NextResponse.json(await createConnection(user, receiverId));
});

export const PATCH = withService(async (request) => {
  const user = await requireSessionUser();
  const { connectionId, status } = await request.json();
  if (!connectionId) throw new ServiceError("bad_request", "Connection ID is required");
  return NextResponse.json(
    await respondToConnection(user, connectionId, status as ConnectionStatus),
  );
});

export const DELETE = withService(async (request) => {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  const targetUserId = searchParams.get("userId");
  if (!connectionId && !targetUserId) {
    throw new ServiceError("bad_request", "Connection ID or User ID is required");
  }
  if (connectionId) {
    return NextResponse.json(await deleteConnectionById(user, connectionId));
  }
  if (!targetUserId) {
    throw new ServiceError("bad_request", "User ID is required");
  }
  return NextResponse.json(await deleteConnectionWith(user, targetUserId));
});
