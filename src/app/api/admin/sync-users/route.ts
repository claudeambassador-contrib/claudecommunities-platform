import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlatformPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// User identity (name/image mirrored from Clerk) is GLOBAL — one User row spans
// all tenants — so this maintenance sync runs on the unscoped platform client.

// POST /api/admin/sync-users - Sync user names from Clerk
export async function POST(_request: Request) {
  try {
    // Check if current user is admin
    const auth = await requirePermissionResponse("users.sync");
    if (!auth.ok) return auth.response;
    const prisma = await getPlatformPrisma();

    // Find all users with missing names that have a clerkId
    const usersWithMissingNamesRaw = await prisma.user.findMany({
      where: {
        name: null,
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
      },
    });

    // Filter to only those with a clerkId
    const usersWithMissingNames = usersWithMissingNamesRaw.filter((u) => u.clerkId !== null);

    if (usersWithMissingNames.length === 0) {
      return NextResponse.json({
        message: "All users have names",
        synced: 0,
      });
    }

    const client = await clerkClient();
    let synced = 0;
    const errors: string[] = [];

    for (const user of usersWithMissingNames) {
      if (!user.clerkId) continue;

      try {
        const clerkUser = await client.users.getUser(user.clerkId);

        if (clerkUser) {
          const name = clerkUser.firstName
            ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
            : null;
          const image = clerkUser.imageUrl;

          if (name) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                name,
                image: image || undefined,
              },
            });
            synced++;
          }
        }
      } catch (err) {
        errors.push(`Failed to sync user ${user.id}: ${err}`);
      }
    }

    return NextResponse.json({
      message: `Synced ${synced} user names`,
      synced,
      total: usersWithMissingNames.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Failed to sync users:", error);
    return NextResponse.json({ error: "Failed to sync users" }, { status: 500 });
  }
}

// GET /api/admin/sync-users - Check how many users need syncing
export async function GET(_request: Request) {
  try {
    const auth = await requirePermissionResponse("users.sync");
    if (!auth.ok) return auth.response;
    const prisma = await getPlatformPrisma();

    const usersRaw = await prisma.user.findMany({
      where: {
        name: null,
      },
      select: {
        clerkId: true,
      },
    });

    const count = usersRaw.filter((u) => u.clerkId !== null).length;

    return NextResponse.json({
      usersNeedingSync: count,
    });
  } catch (error) {
    console.error("Failed to check users:", error);
    return NextResponse.json({ error: "Failed to check users" }, { status: 500 });
  }
}
