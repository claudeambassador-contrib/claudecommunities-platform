import { type NextRequest, NextResponse } from "next/server";
import { chunk } from "@/lib/chunk";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// `body.userIds` is admin-supplied and unbounded; the chunk sizes below keep each
// Prisma call under D1's 100-param cap, accounting for params-per-row: createMany
// binds 2 columns/row (so ≤45 rows), while the deleteMany IN(...) binds 1 id/row.

// GET - Get single list with members
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const prisma = await getPrisma();

    const list = await prisma.contactList.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, city: true },
            },
          },
          take: 100,
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error("Error getting contact list:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update list (metadata or members)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const prisma = await getPrisma();

    const existing = await prisma.contactList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Handle member add/remove actions
    if (body.action === "add" && Array.isArray(body.userIds)) {
      for (const batch of chunk<string>(body.userIds, 45)) {
        await prisma.contactListMember.createMany({
          data: batch.map((userId) => ({
            listId: id,
            userId,
          })),
        });
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === "remove" && Array.isArray(body.userIds)) {
      for (const batch of chunk<string>(body.userIds, 90)) {
        await prisma.contactListMember.deleteMany({
          where: {
            listId: id,
            userId: { in: batch },
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    // Handle metadata update
    const list = await prisma.contactList.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
      },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Error updating contact list:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Alias for PUT (frontend uses POST for add/remove actions)
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PUT(request, context);
}

// DELETE - Delete list (cascade deletes members)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermissionResponse("email.delete");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const prisma = await getPrisma();

    const existing = await prisma.contactList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    await prisma.contactList.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact list:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
