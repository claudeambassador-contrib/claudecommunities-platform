export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import MemberGrid from "@/components/MemberGrid";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getMemberCount, getMemberTabCounts, getProfile, listMembers } from "@/lib/services/users";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

const PAGE_SIZE = 24;

async function getConnections(userId: string) {
  // Connection is tenant-scoped — getPrisma() injects tenantId (the old raw
  // `@/lib/db` query had no tenant filter and listed every tenant's connections).
  const db = await getPrisma();
  return db.connection.findMany({
    where: {
      OR: [{ requesterId: userId }, { receiverId: userId }],
      status: { in: ["pending", "accepted"] },
    },
    select: { id: true, status: true, requesterId: true, receiverId: true },
  });
}

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const userId = user.id;
  const profile = await getProfile(userId);

  const [firstPage, totalMembers, tabCounts, connections] = await Promise.all([
    listMembers({ currentUserId: userId, tab: "all", limit: PAGE_SIZE, offset: 0 }),
    getMemberCount(),
    getMemberTabCounts(userId, profile.location),
    getConnections(userId),
  ]);

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Community Members</h1>
            <p className="text-[#A8A29E]">
              {totalMembers.toLocaleString()} members in the community
            </p>
          </div>
        </div>

        <MemberGrid
          initialMembers={firstPage.members}
          initialTotal={firstPage.total}
          tabCounts={tabCounts}
          currentUser={{
            id: profile.id,
            name: profile.name,
            image: profile.image,
            tagline: profile.tagline,
            location: profile.location,
            role: profile.role,
            points: profile.points,
            level: profile.level,
            _count: { posts: profile._count.posts },
          }}
          currentUserId={userId}
          initialConnections={connections}
        />
      </div>
    </div>
  );
}
