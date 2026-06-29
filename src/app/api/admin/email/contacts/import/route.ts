import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantId } from "@/lib/tenant-context";

// POST - Import contacts to a list
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();
    const tenantId = await getTenantId();

    const { contacts, listId } = await request.json();

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "Contacts array is required" }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;

    for (const contact of contacts) {
      if (!contact.email) {
        skipped++;
        continue;
      }

      // Find existing user by email — restricted to this community's members so
      // a contact list can't be seeded with another tenant's users.
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: contact.email }, tenantMemberships: { some: { tenantId } } },
      });

      if (!existingUser) {
        skipped++;
        continue;
      }

      if (listId) {
        await prisma.contactListMember.createMany({
          data: [{ listId, userId: existingUser.id }],
        });
      }

      added++;
    }

    return NextResponse.json({
      added,
      skipped,
      total: contacts.length,
    });
  } catch (error) {
    console.error("Error importing contacts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
