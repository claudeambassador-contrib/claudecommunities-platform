import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// GET - List all saved segments
export async function GET() {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const prisma = await getPrisma();

  const segments = await prisma.emailSegment.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Parse filters for each segment
  const segmentsWithParsedFilters = segments.map((s) => ({
    ...s,
    filters: JSON.parse(s.filters),
  }));

  return NextResponse.json(segmentsWithParsedFilters);
}

// POST - Create new segment preset
export async function POST(request: NextRequest) {
  const auth = await requirePermissionResponse("email.edit");
  if (!auth.ok) return auth.response;

  const { name, description, filters } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Segment name is required" }, { status: 400 });
  }
  if (!filters || typeof filters !== "object") {
    return NextResponse.json({ error: "Filters are required" }, { status: 400 });
  }

  const prisma = await getPrisma();

  const segment = await prisma.emailSegment.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      filters: JSON.stringify(filters),
    },
  });

  return NextResponse.json({
    ...segment,
    filters,
  });
}
