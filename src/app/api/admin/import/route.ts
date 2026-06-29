import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantId } from "@/lib/tenant-context";

interface ImportUser {
  email: string;
  name?: string;
  linkedin?: string;
  bio?: string;
  tagline?: string;
  experienceLevel?: string;
  city?: string;
}

// POST - Import users from CSV data
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the CSV-parsing/validation/upsert branches would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
export async function POST(request: NextRequest) {
  const db = await getPrisma();
  const tenantId = await getTenantId();
  const auth = await requirePermissionResponse("users.import");
  if (!auth.ok) return auth.response;

  const {
    users,
    eventTag,
    cityTag,
    importSource = "csv_import",
  } = (await request.json()) as {
    users: ImportUser[];
    eventTag?: string;
    cityTag?: string;
    importSource?: string;
  };

  if (!users || !Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: "No users to import" }, { status: 400 });
  }

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  // Create or get tags if specified
  let eventTagId: string | null = null;
  let cityTagId: string | null = null;

  if (eventTag) {
    const tag = await db.userTag.upsert({
      where: { tenantId_name: { tenantId, name: eventTag } },
      create: { name: eventTag, category: "event" },
      update: {},
    });
    eventTagId = tag.id;
  }

  if (cityTag) {
    const tag = await db.userTag.upsert({
      where: { tenantId_name: { tenantId, name: cityTag } },
      create: { name: cityTag, category: "city" },
      update: {},
    });
    cityTagId = tag.id;
  }

  for (const userData of users) {
    try {
      // Validate email
      if (!userData.email || !isValidEmail(userData.email)) {
        results.errors.push({ email: userData.email || "missing", error: "Invalid email" });
        results.skipped++;
        continue;
      }

      const email = userData.email.toLowerCase().trim();

      // Check if user exists
      const existingUser = await db.user.findUnique({
        where: { email },
      });

      let userId: string;

      if (existingUser) {
        // Update existing user with any new data
        const updateData: Record<string, unknown> = {};

        if (userData.linkedin && !existingUser.linkedin) {
          updateData.linkedin = normalizeLinkedIn(userData.linkedin);
        }
        if (userData.bio && !existingUser.bio) {
          updateData.bio = userData.bio;
        }
        if (userData.tagline && !existingUser.tagline) {
          updateData.tagline = userData.tagline;
        }
        if (userData.experienceLevel && !existingUser.experienceLevel) {
          updateData.experienceLevel = userData.experienceLevel;
        }
        if (userData.city && !existingUser.city) {
          updateData.city = userData.city;
        }

        if (Object.keys(updateData).length > 0) {
          await db.user.update({
            where: { id: existingUser.id },
            data: updateData,
          });
          results.updated++;
        } else {
          results.skipped++;
        }

        userId = existingUser.id;
      } else {
        // Create new user with import_ clerkId
        const importClerkId = `import_${generateId()}`;

        const newUser = await db.user.create({
          data: {
            clerkId: importClerkId,
            email,
            name: userData.name || null,
            linkedin: userData.linkedin ? normalizeLinkedIn(userData.linkedin) : null,
            bio: userData.bio || null,
            tagline: userData.tagline || null,
            experienceLevel: userData.experienceLevel || null,
            city: userData.city || null,
            importSource,
            isOnboarded: false,
          },
        });

        userId = newUser.id;
        results.created++;
      }

      // Importing a user into this community makes them a member of it, so the
      // membership exists before they ever sign up: an imported user takes the
      // existing-user link path in resolveSessionUser (isNewSignup stays false),
      // so signup's auto-join never fires for them. Same scoped-upsert shape as
      // the tag assignments below; the chokepoint injects tenantId on create.
      await db.userTenant.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        create: { userId, role: "member" },
        update: {},
      });

      // Apply tags
      if (eventTagId) {
        await db.userTagAssignment.upsert({
          where: {
            tenantId_userId_tagId: { tenantId, userId, tagId: eventTagId },
          },
          create: { userId, tagId: eventTagId },
          update: {},
        });
      }

      if (cityTagId) {
        await db.userTagAssignment.upsert({
          where: {
            tenantId_userId_tagId: { tenantId, userId, tagId: cityTagId },
          },
          create: { userId, tagId: cityTagId },
          update: {},
        });
      }
    } catch (error) {
      results.errors.push({
        email: userData.email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      results.skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    total: users.length,
  });
}

// Helper functions
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function normalizeLinkedIn(input: string): string {
  // Extract LinkedIn URL or username
  const trimmed = input.trim();

  // Already a full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // Clean up the URL
    return trimmed
      .replace(/\/$/, "") // Remove trailing slash
      .replace(/\?.*$/, ""); // Remove query params
  }

  // Just a username or path
  if (trimmed.startsWith("linkedin.com") || trimmed.startsWith("www.linkedin.com")) {
    return `https://${trimmed}`;
  }

  // Assume it's a profile path or username
  if (trimmed.startsWith("/in/") || trimmed.startsWith("in/")) {
    return `https://www.linkedin.com${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  }

  // Just a username
  return `https://www.linkedin.com/in/${trimmed}`;
}
