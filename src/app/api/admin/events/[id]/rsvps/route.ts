import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermissionResponse("events.view");
    if (!auth.ok) return auth.response;

    const { id: eventId } = await params;
    const prisma = await getPrisma();

    const rsvps = await prisma.eventRSVP.findMany({
      where: { eventId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const going = rsvps
      .filter((r) => r.status === "going")
      .map((r) => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        image: r.user.image,
        rsvpDate: r.createdAt,
      }));

    const interested = rsvps
      .filter((r) => r.status === "interested")
      .map((r) => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        image: r.user.image,
        rsvpDate: r.createdAt,
      }));

    const emailsGoing = going.map((r) => r.email).filter(Boolean) as string[];
    const emailsAll = [...going, ...interested].map((r) => r.email).filter(Boolean) as string[];

    return NextResponse.json({
      going,
      interested,
      emailsGoing,
      emailsAll,
      counts: {
        going: going.length,
        interested: interested.length,
        total: rsvps.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch RSVP emails:", error);
    return NextResponse.json({ error: "Failed to fetch RSVP emails" }, { status: 500 });
  }
}
