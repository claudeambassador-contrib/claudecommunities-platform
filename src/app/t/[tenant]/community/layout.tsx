import CommunityLayoutClient from "@/components/CommunityLayoutClient";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

async function getSpaceGroups() {
  const db = await getPrisma();
  return await db.spaceGroup.findMany({
    orderBy: { order: "asc" },
    include: {
      spaces: { orderBy: { order: "asc" } },
    },
  });
}

async function getSpaces() {
  const db = await getPrisma();
  return await db.space.findMany({
    orderBy: { order: "asc" },
  });
}

async function getUserData(userId: string) {
  const db = await getPrisma();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      tagline: true,
      image: true,
    },
  });
  return user;
}

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // If not logged in, the individual pages handle redirect
  // But we still render the nav for logged in users
  if (!user) {
    return <>{children}</>;
  }

  const [spaceGroups, spaces, userData] = await Promise.all([
    getSpaceGroups(),
    getSpaces(),
    getUserData(user.id),
  ]);

  const navUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };

  const sidebarUser = {
    id: userData?.id || user.id,
    name: userData?.name || user.name || "User",
    role: userData?.role || "member",
    tagline: userData?.tagline,
    image: userData?.image,
  };

  const mappedSpaces = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    color: s.color,
    icon: s.icon,
    groupId: s.groupId,
  }));

  const mappedSpaceGroups = spaceGroups.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon || undefined,
    spaces: g.spaces.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      icon: s.icon,
    })),
  }));

  return (
    <CommunityLayoutClient
      navUser={navUser}
      sidebarUser={sidebarUser}
      spaces={mappedSpaces}
      spaceGroups={mappedSpaceGroups}
      currentUserId={user.id}
    >
      {children}
    </CommunityLayoutClient>
  );
}
