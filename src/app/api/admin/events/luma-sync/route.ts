import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

interface LumaEvent {
  api_id: string;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  cover_url: string | null;
  url: string;
  geo_address_info?: {
    city?: string;
  } | null;
}

interface LumaApiResponse {
  entries: Array<{
    event: LumaEvent;
  }>;
  next_cursor?: string | null;
}

export async function POST() {
  try {
    const auth = await requirePermissionResponse("events.edit");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();

    const apiKey = process.env.LUMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "LUMA_API_KEY not configured" }, { status: 500 });
    }

    // Fetch events from Luma API
    const allEvents: LumaEvent[] = [];
    let cursor: string | null = null;

    do {
      const url = new URL("https://api.lu.ma/public/v1/calendar/list-events");
      if (cursor) url.searchParams.set("after", cursor);

      const res = await fetch(url.toString(), {
        headers: { "x-luma-api-key": apiKey },
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Luma API error: ${res.status} ${errText}` },
          { status: 502 },
        );
      }

      const data: LumaApiResponse = await res.json();

      for (const entry of data.entries) {
        allEvents.push(entry.event);
      }

      cursor = data.next_cursor ?? null;
    } while (cursor);

    let created = 0;
    let updated = 0;

    for (const lumaEvent of allEvents) {
      const eventData = {
        title: lumaEvent.name,
        description: lumaEvent.description || null,
        startTime: new Date(lumaEvent.start_at),
        endTime: lumaEvent.end_at ? new Date(lumaEvent.end_at) : null,
        city: lumaEvent.geo_address_info?.city || null,
        lumaUrl: lumaEvent.url,
        imageUrl: lumaEvent.cover_url || null,
        lumaEventId: lumaEvent.api_id,
      };

      const existing = await prisma.event.findFirst({
        where: { lumaEventId: lumaEvent.api_id },
      });

      if (existing) {
        await prisma.event.update({
          where: { id: existing.id },
          data: eventData,
        });
        updated++;
      } else {
        await prisma.event.create({
          data: eventData,
        });
        created++;
      }
    }

    return NextResponse.json({
      synced: allEvents.length,
      created,
      updated,
    });
  } catch (error) {
    console.error("Luma sync failed:", error);
    return NextResponse.json({ error: "Luma sync failed" }, { status: 500 });
  }
}
