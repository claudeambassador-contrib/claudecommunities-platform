import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantId } from "@/lib/tenant-context";

// GET - List contacts (paginated)
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();
    const tenantId = await getTenantId();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(1, Math.min(100, parseInt(searchParams.get("perPage") || "50", 10)));
    const search = searchParams.get("search") || undefined;
    const listId = searchParams.get("listId") || undefined;

    // Contacts ARE global User rows — scope the list to this community's members
    // via the membership join (the scoped client does not filter global User).
    const where: Record<string, unknown> = {
      isBanned: false,
      email: { not: null },
      tenantMemberships: { some: { tenantId } },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (listId) {
      where.contactListMemberships = { some: { listId } };
    }

    const [rawContacts, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          city: true,
          createdAt: true,
          contactListMemberships: {
            include: { list: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.user.count({ where }),
    ]);

    // Map contactListMemberships to a flat `lists` array for the frontend
    const contacts = rawContacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      city: c.city,
      createdAt: c.createdAt,
      lists: c.contactListMemberships.map((m) => m.list),
    }));

    return NextResponse.json({ contacts, total, page, perPage });
  } catch (error) {
    console.error("Error listing contacts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
