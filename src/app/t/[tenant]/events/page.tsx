// ISR: cached render served from the edge (no Worker render on a hit). Refreshed
// on event writes via revalidatePath("/events") in src/lib/services/events.ts;
// the 5-min window is the backstop. Page reads no per-request state (root layout
// + ClerkProvider are client components), so it is genuinely cacheable.
export const revalidate = 300;

import type { Metadata } from "next";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getPrisma } from "@/lib/prisma";
import { getTenantConfig, majorCitiesPhrase } from "@/lib/tenant-config";
import EventsClient from "./EventsClient";

export async function generateMetadata(): Promise<Metadata> {
  const { countryName, majorCities, siteUrl } = await getTenantConfig();
  return {
    title: `Claude Code Meetups ${countryName} | Events & Developer Meetups`,
    description: `Find Claude Code meetups and events across ${countryName}. Join Claude AI meetups in ${await majorCitiesPhrase({ conjunction: "and" })} and more cities. Claude Code events calendar.`,
    keywords: [
      "Claude Code meetups",
      "Claude Code events",
      "Claude meetup",
      "Claude events",
      `Claude ${countryName}`,
      `AI meetups ${countryName}`,
      ...majorCities,
    ],
    openGraph: {
      title: `Claude Code Meetups ${countryName} | Events`,
      description: `Find Claude Code meetups and events across ${countryName}. Claude AI meetups in ${await majorCitiesPhrase({ conjunction: "&" })}.`,
      url: `${siteUrl}/events`,
    },
    alternates: {
      canonical: `${siteUrl}/events`,
    },
  };
}

async function getEvents() {
  const db = await getPrisma();
  try {
    const events = await db.event.findMany({
      where: { isActive: true },
      orderBy: { startTime: "asc" },
      include: {
        _count: {
          select: { rsvps: true },
        },
      },
    });
    return events;
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return [];
  }
}

export default async function EventsPage() {
  const events = await getEvents();
  const { countryName } = await getTenantConfig();

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#E07A5F]/20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-[#E07A5F]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Claude Code Meetups {countryName}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Find Claude Code meetups and events across {countryName}. Network with fellow
            developers, share your projects, and join the Claude AI community.
          </p>
        </div>
      </section>

      {/* Events Content - Client Component for interactivity */}
      <EventsClient initialEvents={JSON.parse(JSON.stringify(events))} />

      {/* CTA Section */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#2a2a2a] to-[#333] rounded-2xl p-8 md:p-12 text-center border border-[#444]">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Want to host a meetup?</h2>
          <p className="text-gray-400 mb-6 max-w-lg mx-auto">
            If you are interested in hosting a Claude Code meetup in your city, we would love to
            hear from you!
          </p>
          <TenantLink
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c96a52] transition-colors font-medium"
          >
            Join the Community
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </TenantLink>
        </div>
      </section>
    </>
  );
}
