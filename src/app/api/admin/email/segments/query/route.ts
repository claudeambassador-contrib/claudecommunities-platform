import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantId } from "@/lib/tenant-context";

// POST - Query users matching segment filters
export async function POST(request: NextRequest) {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  const { filters, includePreview = false } = await request.json();

  // User is GLOBAL — the scoped client does NOT auto-filter it, so restrict the
  // segment audience to THIS community's members via the membership join.
  const where: Prisma.UserWhereInput = {
    email: { not: null },
    isBanned: false,
    tenantMemberships: { some: { tenantId } },
  };

  // City filter
  if (filters?.cities && Array.isArray(filters.cities) && filters.cities.length > 0) {
    where.city = { in: filters.cities };
  }

  // Role filter
  if (filters?.roles && Array.isArray(filters.roles) && filters.roles.length > 0) {
    where.role = { in: filters.roles };
  }

  // Experience level filter
  if (
    filters?.experienceLevels &&
    Array.isArray(filters.experienceLevels) &&
    filters.experienceLevels.length > 0
  ) {
    where.experienceLevel = { in: filters.experienceLevels };
  }

  // Has LinkedIn filter
  if (filters?.hasLinkedIn === true) {
    where.linkedin = { not: null };
  }

  // Signup date range
  if (filters?.signupAfter) {
    where.createdAt = {
      ...((where.createdAt as object) || {}),
      gte: new Date(filters.signupAfter),
    };
  }
  if (filters?.signupBefore) {
    where.createdAt = {
      ...((where.createdAt as object) || {}),
      lte: new Date(filters.signupBefore),
    };
  }

  // Activity level based on lastSeen
  if (filters?.activityLevel === "active") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.lastSeen = { gte: thirtyDaysAgo };
  } else if (filters?.activityLevel === "inactive") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.lastSeen = { lt: thirtyDaysAgo };
  }

  // Event attendance - users who have RSVP'd to specific events
  if (filters?.eventIds && Array.isArray(filters.eventIds) && filters.eventIds.length > 0) {
    where.eventRsvps = {
      some: {
        eventId: { in: filters.eventIds },
        status: "going",
      },
    };
  }

  // Tags filter
  if (filters?.tagIds && Array.isArray(filters.tagIds) && filters.tagIds.length > 0) {
    where.tagAssignments = {
      some: {
        tagId: { in: filters.tagIds },
      },
    };
  }

  // Import source filter
  if (
    filters?.importSources &&
    Array.isArray(filters.importSources) &&
    filters.importSources.length > 0
  ) {
    where.importSource = { in: filters.importSources };
  }

  // Get count
  const count = await prisma.user.count({ where });

  // Get preview if requested
  let preview: Array<{
    id: string;
    name: string | null;
    email: string | null;
    city: string | null;
  }> = [];
  if (includePreview) {
    preview = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({
    count,
    preview,
  });
}

// Also provide GET for available filter options
export async function GET() {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const prisma = await getPrisma();
  const tenantId = await getTenantId();

  // Get unique cities (this community's members only — User is global)
  const cities = await prisma.user.findMany({
    where: { city: { not: null }, tenantMemberships: { some: { tenantId } } },
    select: { city: true },
    distinct: ["city"],
  });

  // Get unique experience levels
  const experienceLevels = await prisma.user.findMany({
    where: { experienceLevel: { not: null }, tenantMemberships: { some: { tenantId } } },
    select: { experienceLevel: true },
    distinct: ["experienceLevel"],
  });

  // Get events
  const events = await prisma.event.findMany({
    select: { id: true, title: true, city: true, startTime: true },
    orderBy: { startTime: "desc" },
    take: 50,
  });

  // Get tags
  const tags = await prisma.userTag.findMany({
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  // Get import sources
  const importSources = await prisma.user.findMany({
    where: { importSource: { not: null }, tenantMemberships: { some: { tenantId } } },
    select: { importSource: true },
    distinct: ["importSource"],
  });

  return NextResponse.json({
    cities: cities.map((c) => c.city).filter(Boolean),
    experienceLevels: experienceLevels.map((e) => e.experienceLevel).filter(Boolean),
    events,
    tags,
    importSources: importSources.map((i) => i.importSource).filter(Boolean),
    roles: ["member", "admin"],
    activityLevels: ["active", "inactive"],
  });
}
