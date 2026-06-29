import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  order: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const auth = await requirePermissionResponse("events.edit");
  if (!auth.ok) return auth.response;
  const { id: eventId, rid } = await params;
  const prisma = await getPrisma();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.eventResource.findUnique({ where: { id: rid } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.eventResource.update({
    where: { id: rid },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const auth = await requirePermissionResponse("events.delete");
  if (!auth.ok) return auth.response;
  const { id: eventId, rid } = await params;
  const prisma = await getPrisma();

  const existing = await prisma.eventResource.findUnique({ where: { id: rid } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.eventResource.delete({ where: { id: rid } });
  return NextResponse.json({ success: true });
}
