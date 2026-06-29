import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

// Authed-only list of resources for an event. The event lookup accepts either
// id or slug to mirror the public event page route.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const prisma = await getPrisma();

  const event = await prisma.event.findFirst({
    where: { AND: [{ isActive: true }, { OR: [{ id }, { slug: id }] }] },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const resources = await prisma.eventResource.findMany({
    where: { eventId: event.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
    },
  });

  return NextResponse.json(resources);
}
