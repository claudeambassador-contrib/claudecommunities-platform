export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ProfileSettingsForm from "./ProfileSettingsForm";

async function getUser(userId: string) {
  const db = await getPrisma();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      coverImage: true,
      bio: true,
      location: true,
      website: true,
      twitter: true,
      linkedin: true,
      github: true,
    },
  });
  return user;
}

export default async function ProfileSettingsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const userId = currentUser.id;
  if (!userId) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const profileUser = await getUser(userId);

  if (!profileUser) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Edit Profile</h1>
        <ProfileSettingsForm user={profileUser} />
      </div>
    </div>
  );
}
