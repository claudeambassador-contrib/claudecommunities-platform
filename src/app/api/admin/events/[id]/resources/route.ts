import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  fileUrl: z.string().url().max(2000),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  fileSize: z.number().int().nonnegative(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("events.view");
  if (!auth.ok) return auth.response;
  const { id: eventId } = await params;
  const prisma = await getPrisma();

  const resources = await prisma.eventResource.findMany({
    where: { eventId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(resources);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("events.edit");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const { id: eventId } = await params;
  const prisma = await getPrisma();

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const last = await prisma.eventResource.findFirst({
    where: { eventId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const resource = await prisma.eventResource.create({
    data: {
      eventId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      fileSize: parsed.data.fileSize,
      order: nextOrder,
      uploadedBy: user.id,
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
