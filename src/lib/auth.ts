import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantIdOrNull } from "@/lib/tenant-context";
import { publishNotification } from "./notify";
import { getPlatformPrisma } from "./prisma";

// Fire-and-forget Slack notification for a brand-new signup. Both create
// paths below (getCurrentUser / ensureUserInDb) call this; the unique clerkId
// constraint guarantees a real new user is only created — and so only fires —
// once, even across concurrent requests. `baseUrl` is the tenant's appUrl,
// resolved by the (async, request-scoped) caller on the new-signup path.
function notifySignup(
  user: { id: string; name: string | null; email: string | null },
  baseUrl: string,
) {
  publishNotification({
    type: "community.user.signed_up",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      manageUrl: `${baseUrl}/admin/users`,
    },
  });
}

// Resolve the Clerk session into the user's database record, creating or
// syncing it on first sight. Shared by getCurrentUser (RSC, memoized) and
// ensureUserInDb (API routes, unmemoized).
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tightly coupled session-resolution branching (find/sync/link/create + P2002 race recovery) shares the user + isNewSignup state and a single try/catch; splitting it would spread that shared mutable state across helpers and risk the concurrency handling
async function resolveSessionUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // User is a GLOBAL identity (not tenant-scoped) — resolve via the unscoped
  // platform client. `prisma` below is this local handle, not the old default.
  const prisma = await getPlatformPrisma();

  // Find user by clerkId
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  // If user exists but name is missing, try to sync from Clerk
  if (user && !user.name) {
    const clerkUser = await currentUser();
    if (clerkUser) {
      const name = clerkUser.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
        : null;
      const image = clerkUser.imageUrl;
      if (name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name, image: user.image || image },
        });
      }
    }
  }

  let isNewSignup = false;
  if (!user) {
    // Get user details from Clerk
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = clerkUser.firstName
      ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
      : null;
    const image = clerkUser.imageUrl;

    try {
      // Check if user exists with this email (case-insensitive to match imported/invited users)
      if (email) {
        const existingUser = await prisma.user.findFirst({
          where: { email: { equals: email } },
        });

        if (existingUser) {
          // Link the existing user to this Clerk account
          user = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              clerkId: userId,
              name: existingUser.name || name,
              image: existingUser.image || image,
            },
          });
        } else {
          // Create new user
          user = await prisma.user.create({
            data: {
              clerkId: userId,
              email,
              name,
              image,
            },
          });
          isNewSignup = true;
        }
      } else {
        // No email, create user without email
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            name,
            image,
          },
        });
        isNewSignup = true;
      }
    } catch (error: unknown) {
      // Handle race condition - another request may have created the user
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        // Unique constraint violation - user was created by another request
        user = await prisma.user.findUnique({
          where: { clerkId: userId },
        });
      } else {
        throw error;
      }
    }
  }

  if (isNewSignup && user) {
    // Auto-join a brand-new signup to the tenant they registered on (the
    // community resolved from the request) as a plain member — the only
    // membership an organic signup gets; admins promote from there. Users
    // provisioned before signup (invited OR CSV-imported) never reach here:
    // they match the existing-user link path above, so isNewSignup stays false
    // and they keep the membership granted at invite/import time. UserTenant is
    // tenant-scoped, but we hold the platform client (User is global), so pass
    // tenantId explicitly — same pattern as the invite route. upsert keeps it
    // idempotent against the create-race / retries.
    //
    // On the PLATFORM apex there is no tenant in scope (`getTenantIdOrNull` is
    // null). We still create the global User row, but defer membership — they'll
    // be enrolled the first time they enter a community.
    const tenantId = await getTenantIdOrNull();
    if (tenantId) {
      await prisma.userTenant.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        create: { tenantId, userId: user.id, role: "member" },
        update: {},
      });
      notifySignup(user, (await getTenantConfig()).appUrl);
    } else {
      notifySignup(user, "");
    }
  }
  return user;
}

// Get current user's database record from Clerk session.
//
// Wrapped in React `cache()` so it runs at most once per server request:
// the community layout, the page, `getCurrentUserWithPermissions()` and
// `isAdmin()` all call this within a single RSC render, and without
// memoization each call re-issued the Clerk lookup + a fresh Prisma D1
// query (every Prisma access instantiates a new WASM-backed client — see
// `src/lib/prisma.ts`). `cache()` is scoped to one request, so it never
// leaks a user across requests.
export const getCurrentUser = cache(resolveSessionUser);

// Ensure user exists in database (used by API routes, where React cache()
// memoization is not available).
export async function ensureUserInDb() {
  return resolveSessionUser();
}

// Check if user has any admin permission (any non-member role).
// Kept for callers that only care about "can this user reach admin areas".
export async function isAdmin() {
  const { getActorPermissions, hasAnyAdminPermission } = await import("./permissions");
  const user = await getCurrentUser();
  if (!user) return false;
  // Admin-ness is per-tenant: the membership role for the URL tenant, not the
  // global User.role (a global admin who isn't a member here gets nothing).
  const { permissions } = await getActorPermissions(user.id);
  return hasAnyAdminPermission({ permissions });
}

// Resolve the current Clerk session into a DB user + their role's
// permission list. Returns null if not signed in.
export async function getCurrentUserWithPermissions() {
  const { getActorPermissions } = await import("./permissions");
  const user = await getCurrentUser();
  if (!user) return null;
  // Permissions from the URL-tenant membership role, not the global User.role.
  const { permissions } = await getActorPermissions(user.id);
  return Object.assign(user, { permissions });
}
