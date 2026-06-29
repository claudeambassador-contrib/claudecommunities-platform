import { NextResponse } from "next/server";
import { getPlatformPrisma } from "@/lib/prisma";
import { getInviteEmailHtml, sendEmail } from "@/lib/resend";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";

export async function POST(request: Request) {
  try {
    const auth = await requirePermissionResponse("users.invite");
    if (!auth.ok) return auth.response;

    // User identity is global, but an invite grants membership in the ACTING
    // tenant (the admin's community, resolved from the request header) — so a
    // newly invited person belongs to THIS community, not to all of them.
    const prisma = await getPlatformPrisma();
    const tenantId = await getTenantId();

    const body = await request.json();
    const { name, email, personalMessage } = body;

    if (!email?.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, clerkId: true },
    });

    if (existingUser) {
      // If user exists but was previously invited (no real Clerk ID), we can resend
      if (existingUser.clerkId.startsWith("invite_")) {
        // Update name if provided and send email again
        if (name) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { name },
          });
        }

        // Ensure the re-invited user is a member of this community.
        await prisma.userTenant.upsert({
          where: { tenantId_userId: { tenantId, userId: existingUser.id } },
          create: { tenantId, userId: existingUser.id, role: "member" },
          update: {},
        });

        // Send invite email
        const html = getInviteEmailHtml(name || "there", await getTenantConfig(), personalMessage);
        const emailResult = await sendEmail({
          to: email,
          subject: "You're Invited to Claude Code Community!",
          html,
        });

        if (!emailResult.success) {
          return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "Invite resent successfully",
          userId: existingUser.id,
          isResend: true,
        });
      }

      return NextResponse.json(
        {
          error: "User already exists in the community",
          existingUser: { id: existingUser.id, name: existingUser.name },
        },
        { status: 409 },
      );
    }

    // Create new invited user with placeholder clerkId
    const inviteClerkId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newUser = await prisma.user.create({
      data: {
        clerkId: inviteClerkId,
        name: name || null,
        email,
        importSource: "admin_invite",
        isOnboarded: false,
      },
    });

    // Grant membership in the acting community (fresh user → plain create).
    await prisma.userTenant.create({
      data: { tenantId, userId: newUser.id, role: "member" },
    });

    // Send invite email
    const html = getInviteEmailHtml(name || "there", await getTenantConfig(), personalMessage);
    const emailResult = await sendEmail({
      to: email,
      subject: "You're Invited to Claude Code Community!",
      html,
    });

    if (!emailResult.success) {
      // Still return success but note email failed
      return NextResponse.json({
        success: true,
        message: "User created but email failed to send",
        userId: newUser.id,
        emailSent: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Invite sent successfully",
      userId: newUser.id,
      emailSent: true,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Failed to process invite" }, { status: 500 });
  }
}

// Get recently invited users
export async function GET() {
  try {
    const auth = await requirePermissionResponse("users.invite");
    if (!auth.ok) return auth.response;

    const prisma = await getPlatformPrisma();
    const tenantId = await getTenantId();

    // Only this community's invited users (membership join — these pre-signup
    // shells are global User rows, so the tenant scope comes from the join).
    const invitedUsers = await prisma.user.findMany({
      where: {
        importSource: "admin_invite",
        tenantMemberships: { some: { tenantId } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        clerkId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Mark which users have completed signup (clerkId no longer starts with invite_)
    const usersWithStatus = invitedUsers.map((u) => ({
      ...u,
      hasSignedUp: !u.clerkId.startsWith("invite_"),
    }));

    return NextResponse.json({ users: usersWithStatus });
  } catch (error) {
    console.error("Get invited users error:", error);
    return NextResponse.json({ error: "Failed to fetch invited users" }, { status: 500 });
  }
}
