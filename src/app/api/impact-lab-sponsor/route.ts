import { NextResponse } from "next/server";
import { getPlatformPrisma } from "@/lib/prisma";
import { getNotificationEmailHtml, sendEmail } from "@/lib/resend";
import { getTenantConfig } from "@/lib/tenant-config";

const VALID_SPONSORSHIP_TYPES = [
  "event",
  "drinks",
  "catering",
  "venue",
  "swag",
  "data",
  "prizes",
  "other",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      contactName,
      contactRole,
      organisation,
      email,
      phone,
      website,
      sponsorshipTypes,
      budget,
      message,
    } = body;

    if (!contactName?.trim()) {
      return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
    }
    if (!organisation?.trim()) {
      return NextResponse.json({ error: "Organisation is required" }, { status: 400 });
    }
    if (!email?.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!Array.isArray(sponsorshipTypes) || sponsorshipTypes.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one sponsorship type" },
        { status: 400 },
      );
    }

    const cleanedTypes = sponsorshipTypes
      .filter((t: unknown): t is string => typeof t === "string")
      .filter((t: string) => VALID_SPONSORSHIP_TYPES.includes(t));

    if (cleanedTypes.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one valid sponsorship type" },
        { status: 400 },
      );
    }

    // ImpactLab* models + the global-admin notification are a single shared
    // event portal (GLOBAL, not per-tenant) — platform client throughout.
    const prisma = await getPlatformPrisma();

    const submission = await prisma.impactLabSponsor.create({
      data: {
        contactName: contactName.trim(),
        contactRole: contactRole?.trim() || null,
        organisation: organisation.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        sponsorshipTypes: JSON.stringify(cleanedTypes),
        budget: budget?.trim() || null,
        message: message?.trim() || null,
        event: "melbourne-may-2026",
      },
    });

    try {
      const admins = await prisma.user.findMany({
        where: { role: "admin" },
        select: { email: true },
      });

      const adminEmails = admins.map((a) => a.email).filter((e): e is string => !!e);

      if (adminEmails.length > 0) {
        const typeLabels: Record<string, string> = {
          event: "Event sponsor",
          drinks: "Drinks sponsor",
          catering: "Catering partner",
          venue: "Venue partner",
          swag: "Merch / swag sponsor",
          data: "Data partner",
          prizes: "Prize sponsor",
          other: "Other",
        };

        const formattedTypes = cleanedTypes.map((t) => typeLabels[t] ?? t).join(", ");

        const messageHtml =
          `<strong>${contactName}</strong> from <strong>${organisation}</strong> wants to sponsor the Claude Impact Lab Melbourne.<br/><br/>` +
          `<strong>Sponsorship interest:</strong> ${formattedTypes}<br/>` +
          `<strong>Email:</strong> ${email}<br/>` +
          (contactRole ? `<strong>Role:</strong> ${contactRole}<br/>` : "") +
          (phone ? `<strong>Phone:</strong> ${phone}<br/>` : "") +
          (website ? `<strong>Website:</strong> ${website}<br/>` : "") +
          (budget ? `<strong>Indicative budget:</strong> ${budget}<br/>` : "") +
          (message ? `<br/><strong>Message:</strong><br/>${message}` : "");

        await sendEmail({
          to: adminEmails,
          replyTo: email.trim().toLowerCase(),
          subject: `Impact Lab Sponsor Enquiry: ${organisation}`,
          html: getNotificationEmailHtml(
            "Admin",
            "New Impact Lab Sponsor Enquiry",
            messageHtml,
            "/events/claude-impact-lab-melbourne/sponsor",
            await getTenantConfig(),
          ),
        });
      }
    } catch (emailError) {
      console.error("Failed to send admin sponsor notification:", emailError);
    }

    return NextResponse.json({ success: true, id: submission.id });
  } catch (error) {
    console.error("Impact Lab sponsor error:", error);
    return NextResponse.json({ error: "Failed to submit sponsorship enquiry" }, { status: 500 });
  }
}
