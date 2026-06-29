import {
  ArrowRight,
  Bell,
  Calendar,
  Clock,
  MapPin,
  MessageSquare,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventAttendance } from "@/components/EventAttendance";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { type City, capitalCities, cityBySlug, cityCount, regionalCities } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getPrisma } from "@/lib/prisma";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";

// ISR (on-demand): no generateStaticParams, so each slug renders at runtime on
// first hit — where D1 is bound — then is cached, sidestepping the build-time
// static-generation failure the old force-dynamic worked around. Refreshed on
// event writes via revalidatePath("/cities/[slug]", "page"); 5-min backstop.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cities = await getCities();
  const city = cityBySlug(cities, slug);

  if (!city) {
    return { title: "City Not Found" };
  }

  const config = await getTenantConfig();
  const baseUrl = await siteUrl();
  const title = `Claude Code ${city.name} - AI Developer Meetups & Community`;
  const description = `${city.description} Find Claude Code meetups, workshops, and hackathons in ${city.name}, ${city.stateFull}.`;
  const url = `${baseUrl}/cities/${city.slug}`;

  return {
    title,
    description,
    keywords: city.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: config.communityName,
      locale: await ogLocale(),
      images: [
        {
          url: "/images/claude-code-logo.webp",
          width: 500,
          height: 500,
          alt: `Claude Code Community ${city.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/claude-code-logo.webp"],
    },
  };
}

async function getCityEvents(cityName: string) {
  const prisma = await getPrisma();
  const events = await prisma.event.findMany({
    where: {
      isActive: true,
      city: {
        contains: cityName,
      },
      startTime: { gte: new Date() },
    },
    include: {
      _count: { select: { rsvps: true } },
    },
    orderBy: { startTime: "asc" },
    take: 6,
  });

  return events.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    location: event.location,
    city: event.city,
    eventType: event.eventType,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime?.toISOString(),
    maxAttendees: event.maxAttendees,
    isOnline: event.isOnline,
    imageUrl: event.imageUrl,
    lumaUrl: event.lumaUrl,
    rsvpEnabled: event.rsvpEnabled,
    attendeeCount: event._count.rsvps,
  }));
}

async function getCommunityStats() {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  // User is GLOBAL — count only this tenant's members. Post is auto-scoped.
  const [memberCount, postCount] = await Promise.all([
    prisma.user.count({ where: { tenantMemberships: { some: { tenantId } } } }),
    prisma.post.count(),
  ]);
  return { memberCount, postCount };
}

function JsonLd({
  city,
  events,
  baseUrl,
  communityName,
  countryCode,
}: {
  city: City;
  events: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: string;
    endTime?: string;
  }[];
  baseUrl: string;
  communityName: string;
  countryCode: string;
}) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: communityName,
    url: baseUrl,
    logo: `${baseUrl}/images/claude-code-logo.webp`,
    sameAs: [],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Cities",
        item: `${baseUrl}/cities`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: city.name,
        item: `${baseUrl}/cities/${city.slug}`,
      },
    ],
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Claude Code ${city.name}`,
    description: city.description,
    url: `${baseUrl}/cities/${city.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: communityName,
      url: baseUrl,
    },
    about: {
      "@type": "City",
      name: city.name,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: city.stateFull,
      },
    },
  };

  const eventSchemas = events.map((event) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || `Claude Code meetup in ${city.name}`,
    startDate: event.startTime,
    ...(event.endTime && { endDate: event.endTime }),
    location: {
      "@type": "Place",
      name: event.location || city.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: city.name,
        addressRegion: city.state,
        addressCountry: countryCode,
      },
    },
    organizer: {
      "@type": "Organization",
      name: communityName,
      url: baseUrl,
    },
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
  }));

  const schemas = [organizationSchema, breadcrumbSchema, webPageSchema, ...eventSchemas];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          // biome-ignore lint/suspicious/noArrayIndexKey: static schema list, fixed order, never reordered or inserted
          key={i}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data built from typed schema objects via JSON.stringify, not user HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cities = await getCities();
  const city = cityBySlug(cities, slug);

  if (!city) {
    notFound();
  }

  const [events, stats] = await Promise.all([getCityEvents(city.name), getCommunityStats()]);

  const config = await getTenantConfig();
  const baseUrl = await siteUrl();
  const capitals = capitalCities(cities);
  const regionals = regionalCities(cities);
  const totalCities = cityCount(cities);
  const countryCode = config.lang.split("-")[1]?.toUpperCase() ?? "";

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <JsonLd
        city={city}
        events={events}
        baseUrl={baseUrl}
        communityName={config.communityName}
        countryCode={countryCode}
      />

      {/* Hero Section */}
      <section className="pt-[92px] pb-16 px-6 bg-gradient-to-b from-[#D4836A]/10 to-transparent">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2 text-[#D4836A] mb-4">
            <MapPin className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">
              {city.stateFull}, {config.countryName}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Claude Code {city.name}
          </h1>
          <p className="text-xl text-[#A8A29E] max-w-2xl mb-8">{city.description}</p>
          <div className="flex flex-wrap gap-4">
            <TenantLink
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
            >
              <Users className="w-5 h-5" />
              Join the Community
            </TenantLink>
            <TenantLink
              href="#events"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium rounded-xl transition-colors"
            >
              <Calendar className="w-5 h-5" />
              View Events
            </TenantLink>
          </div>
        </div>
      </section>

      {/* Community Stats Banner */}
      <section className="py-12 px-6 border-y border-white/[0.06] bg-[#2D2926]/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{stats.memberCount}</div>
              <div className="text-sm text-[#A8A29E]">Community Members</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{events.length}</div>
              <div className="text-sm text-[#A8A29E]">Upcoming Events</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{stats.postCount}</div>
              <div className="text-sm text-[#A8A29E]">Community Posts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{totalCities}</div>
              <div className="text-sm text-[#A8A29E]">Cities Across {config.countryName}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section id="events" className="py-16 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Upcoming Events in {city.name}</h2>
              <p className="text-[#A8A29E]">Join our local meetups and workshops</p>
            </div>
            <TenantLink
              href="/events"
              className="text-[#D4836A] hover:text-white transition-colors text-sm font-medium flex items-center gap-1"
            >
              View all events <ArrowRight className="w-4 h-4" />
            </TenantLink>
          </div>

          {events.length === 0 ? (
            <div className="bg-[#2D2926] rounded-2xl p-12 border border-white/[0.06]">
              <div className="max-w-lg mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#D4836A]/10 flex items-center justify-center mx-auto mb-6">
                  <Bell className="w-8 h-8 text-[#D4836A]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  {city.name} events coming soon
                </h3>
                <p className="text-[#A8A29E] mb-3 leading-relaxed">
                  We&apos;re expanding across {config.countryName} and {city.name} is next. Sign in
                  to get notified when the first meetup is announced — or help us organise one.
                </p>
                <p className="text-sm text-[#78716C] mb-8">
                  Join {stats.memberCount}+ members already in the community across {totalCities}{" "}
                  cities.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <TenantLink
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    Sign In to Get Notified
                  </TenantLink>
                  <TenantLink
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium rounded-xl transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                    Create Free Account
                  </TenantLink>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const date = new Date(event.startTime);
                const day = date.getDate();
                const month = date.toLocaleDateString(config.lang, { month: "short" });
                const time = date.toLocaleTimeString(config.lang, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });

                return (
                  <TenantLink
                    key={event.id}
                    href={`/events/${event.slug || event.id}`}
                    className="group bg-[#2D2926] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all"
                  >
                    {event.imageUrl ? (
                      <div className="aspect-video bg-[#1C1917] overflow-hidden">
                        <RemoteImage
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-[#D4836A]/20 to-[#8B5CF6]/20 flex items-center justify-center">
                        <Calendar className="w-12 h-12 text-[#78716C]" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-14 rounded-lg bg-[#D4836A]/10 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] text-[#D4836A] font-medium uppercase">
                            {month}
                          </span>
                          <span className="text-xl font-bold text-white leading-none">{day}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-[#D4836A] transition-colors line-clamp-1">
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-[#78716C] mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{time}</span>
                          </div>
                        </div>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-[#A8A29E]">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      <EventAttendance event={event}>
                        <div className="flex items-center gap-2 text-sm text-[#78716C] mt-2">
                          <Users className="w-4 h-4" />
                          <span>{event.attendeeCount} attending</span>
                        </div>
                      </EventAttendance>
                    </div>
                  </TenantLink>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Join Community CTA */}
      <section className="py-16 px-6 bg-gradient-to-b from-transparent to-[#D4836A]/10">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A]/20 rounded-full text-[#D4836A] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Join the conversation
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Connect with {city.name} Developers
          </h2>
          <p className="text-xl text-[#A8A29E] mb-8">
            Join our online community to share experiences, get help with Claude Code, and stay
            updated on local meetups and events.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TenantLink
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#D4836A] hover:bg-[#c4775f] text-white font-semibold rounded-xl transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              Join the Community
            </TenantLink>
            <TenantLink
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.05] hover:bg-white/[0.1] text-white font-semibold rounded-xl transition-colors"
            >
              Learn More
              <ArrowRight className="w-5 h-5" />
            </TenantLink>
          </div>
        </div>
      </section>

      {/* Other Cities */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Explore Other Cities</h2>

          {/* Capital Cities */}
          <h3 className="text-sm font-medium text-[#A8A29E] uppercase tracking-wider mb-4">
            Capital Cities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {capitals
              .filter((c) => c.slug !== slug.toLowerCase())
              .map((c) => (
                <TenantLink
                  key={c.slug}
                  href={`/cities/${c.slug}`}
                  className="p-4 bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-[#D4836A]/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#78716C] group-hover:text-[#D4836A] transition-colors" />
                    <div>
                      <span className="font-medium text-white">{c.name}</span>
                      <span className="text-xs text-[#78716C] ml-2">{c.state}</span>
                    </div>
                  </div>
                </TenantLink>
              ))}
          </div>

          {/* Regional Cities */}
          <h3 className="text-sm font-medium text-[#A8A29E] uppercase tracking-wider mb-4">
            Regional Cities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {regionals
              .filter((c) => c.slug !== slug.toLowerCase())
              .map((c) => (
                <TenantLink
                  key={c.slug}
                  href={`/cities/${c.slug}`}
                  className="p-4 bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-[#D4836A]/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#78716C] group-hover:text-[#D4836A] transition-colors" />
                    <div>
                      <span className="font-medium text-white">{c.name}</span>
                      <span className="text-xs text-[#78716C] ml-2">{c.state}</span>
                    </div>
                  </div>
                </TenantLink>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
