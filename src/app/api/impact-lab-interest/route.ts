import { NextResponse } from "next/server";
import { getPlatformPrisma } from "@/lib/prisma";
import { getNotificationEmailHtml, sendEmail } from "@/lib/resend";
import { getTenantConfig } from "@/lib/tenant-config";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, role, expertise, interest } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email?.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // ImpactLab* models + the global-admin notification are a single shared
    // event portal (GLOBAL, not per-tenant) — platform client throughout.
    const prisma = await getPlatformPrisma();

    const existing = await prisma.impactLabInterest.findFirst({
      where: { email: email.trim().toLowerCase(), event: "melbourne-may-2026" },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already registered your interest!" },
        { status: 409 },
      );
    }

    const submission = await prisma.impactLabInterest.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role?.trim() || null,
        expertise: expertise?.trim() || null,
        interest: interest?.trim() || null,
        event: "melbourne-may-2026",
      },
    });

    // Notify admins
    try {
      const admins = await prisma.user.findMany({
        where: { role: "admin" },
        select: { email: true },
      });

      const adminEmails = admins.map((a) => a.email).filter((e): e is string => !!e);

      if (adminEmails.length > 0) {
        const message = `<strong>${name}</strong> registered early interest for the Claude Impact Lab Melbourne.<br/><br/>Email: ${email}${role ? `<br/>Role: ${role}` : ""}${expertise ? `<br/>Expertise: ${expertise}` : ""}${interest ? `<br/><br/>What they want to build: ${interest}` : ""}`;

        await sendEmail({
          to: adminEmails,
          subject: `Impact Lab Melbourne Interest: ${name}`,
          html: getNotificationEmailHtml(
            "Admin",
            "New Impact Lab Interest",
            message,
            "/events/claude-impact-lab-melbourne",
            await getTenantConfig(),
          ),
        });
      }
    } catch (emailError) {
      console.error("Failed to send admin notification:", emailError);
    }

    return NextResponse.json({ success: true, id: submission.id });
  } catch (error) {
    console.error("Impact Lab interest error:", error);
    return NextResponse.json({ error: "Failed to register interest" }, { status: 500 });
  }
}
