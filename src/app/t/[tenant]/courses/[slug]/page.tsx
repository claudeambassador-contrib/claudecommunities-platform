import { ArrowLeft, Calendar, Clock, Edit, ExternalLink, MapPin, User, Video } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LessonContent from "@/components/LessonContent";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { timezoneForCity } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getPrisma } from "@/lib/prisma";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

async function getCourse(param: string) {
  const db = await getPrisma();
  return await db.scheduledCourse.findFirst({
    where: {
      OR: [{ slug: param }, { id: param }],
      isPublished: true,
    },
  });
}

function getTimezoneAbbr(date: Date, timeZone: string, lang: string): string {
  const parts = new Intl.DateTimeFormat(lang, {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);

  if (!course) {
    return { title: "Course Not Found" };
  }

  const baseUrl = await siteUrl();
  const { communityName } = await getTenantConfig();
  const title = `${course.title} - Claude Code Community`;
  const description = course.description
    ? course.description.slice(0, 160)
    : `Join ${course.title} — a ${course.courseType} from Claude Code Community.`;
  const url = `${baseUrl}/courses/${course.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: communityName,
      locale: await ogLocale(),
      images: [
        {
          url: course.imageUrl || "/images/claude-code-logo.webp",
          width: 1200,
          height: 630,
          alt: course.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [course.imageUrl || "/images/claude-code-logo.webp"],
    },
  };
}

function JsonLd({
  course,
  baseUrl,
  communityName,
  currency,
  countryCode,
}: {
  course: {
    slug: string;
    title: string;
    description: string | null;
    location: string | null;
    city: string | null;
    startTime: Date;
    endTime: Date | null;
    isOnline: boolean;
    imageUrl: string | null;
    price: string | null;
    instructor: string | null;
  };
  baseUrl: string;
  communityName: string;
  currency: string;
  countryCode: string;
}) {
  const courseUrl = `${baseUrl}/courses/${course.slug}`;
  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "EducationEvent",
    name: course.title,
    description: course.description || `Claude Code Community course: ${course.title}`,
    startDate: course.startTime.toISOString(),
    ...(course.endTime && { endDate: course.endTime.toISOString() }),
    location: course.isOnline
      ? { "@type": "VirtualLocation", url: courseUrl }
      : {
          "@type": "Place",
          name: course.location || course.city || "TBA",
          ...(course.city && {
            address: {
              "@type": "PostalAddress",
              addressLocality: course.city,
              addressCountry: countryCode,
            },
          }),
        },
    organizer: {
      "@type": "Organization",
      name: communityName,
      url: baseUrl,
    },
    eventAttendanceMode: course.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    ...(course.imageUrl && { image: course.imageUrl }),
    ...(course.instructor && {
      performer: { "@type": "Person", name: course.instructor },
    }),
    offers: {
      "@type": "Offer",
      price: course.price || "0",
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Courses", item: `${baseUrl}/courses` },
      { "@type": "ListItem", position: 3, name: course.title, item: courseUrl },
    ],
  };

  return (
    <>
      {[
        { id: "course", schema: courseSchema },
        { id: "breadcrumb", schema: breadcrumbSchema },
      ].map(({ id, schema }) => (
        <script
          key={id}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built server-side from trusted course data via JSON.stringify, no user HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

const courseTypeBadge: Record<string, string> = {
  workshop: "bg-purple-500/20 text-purple-400",
  bootcamp: "bg-blue-500/20 text-blue-400",
  webinar: "bg-amber-500/20 text-amber-400",
  seminar: "bg-green-500/20 text-green-400",
  training: "bg-rose-500/20 text-rose-400",
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [course, user, cities] = await Promise.all([
    getCourse(slug),
    getCurrentUserWithPermissions(),
    getCities(),
  ]);

  if (!course) {
    notFound();
  }

  const baseUrl = await siteUrl();
  const { communityName, currency, lang, defaultTimezone } = await getTenantConfig();
  const countryCode = (lang.split("-")[1] ?? "").toUpperCase();

  const isAdmin = user?.permissions.includes("courses.edit") ?? false;
  const isPast = course.startTime <= new Date();
  const tz = course.timezone || timezoneForCity(cities, course.city || "", defaultTimezone);
  const tzAbbr = getTimezoneAbbr(course.startTime, tz, lang);

  const formatDate = (date: Date) =>
    date.toLocaleDateString(lang, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });

  const badgeColor = courseTypeBadge[course.courseType] || "bg-[#D4836A]/20 text-[#D4836A]";

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <JsonLd
        course={course}
        baseUrl={baseUrl}
        communityName={communityName}
        currency={currency}
        countryCode={countryCode}
      />

      {/* Back link */}
      <div className="pt-[92px] px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <TenantLink
              href="/courses"
              className="inline-flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Courses
            </TenantLink>
            {isAdmin && (
              <TenantLink
                href={`/admin/courses/new?edit=${course.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#2D2926] text-[#A8A29E] hover:text-white border border-white/[0.06] rounded-lg hover:bg-white/5 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Course
              </TenantLink>
            )}
          </div>
        </div>
      </div>

      {/* Course image */}
      <div className="px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#D4836A]/20 to-[#3D3936] aspect-video flex items-center justify-center">
            {course.imageUrl ? (
              <RemoteImage
                src={course.imageUrl}
                alt={course.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <Calendar className="w-16 h-16 text-[#78716C]" />
            )}
            <div className="absolute top-4 left-4">
              <span
                className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize ${badgeColor}`}
              >
                {course.courseType}
              </span>
            </div>
            {isPast && (
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 text-[#A8A29E]">
                  Past Course
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Course content */}
      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">{course.title}</h1>

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-[#A8A29E]">
              <Clock className="w-5 h-5 shrink-0 text-[#78716C]" />
              <span>
                {formatDate(course.startTime)} at {formatTime(course.startTime)}
                {course.endTime && ` – ${formatTime(course.endTime)}`}
                {tzAbbr && ` ${tzAbbr}`}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[#A8A29E]">
              {course.isOnline ? (
                <>
                  <Video className="w-5 h-5 shrink-0 text-[#78716C]" />
                  <span>Online Course</span>
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5 shrink-0 text-[#78716C]" />
                  <span>{course.location || course.city || "Location TBA"}</span>
                </>
              )}
            </div>

            {course.instructor && (
              <div className="flex items-center gap-3 text-[#A8A29E]">
                <User className="w-5 h-5 shrink-0 text-[#78716C]" />
                <span>Instructor: {course.instructor}</span>
              </div>
            )}

            {course.price && (
              <div className="flex items-center gap-3 text-[#D4836A] font-medium">
                <span className="w-5 h-5 shrink-0 text-[#78716C] flex items-center justify-center text-sm">
                  $
                </span>
                <span>{course.price}</span>
              </div>
            )}

            {course.maxAttendees && course.maxAttendees > 0 && (
              <div className="flex items-center gap-3 text-[#A8A29E]">
                <svg
                  className="w-5 h-5 shrink-0 text-[#78716C]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>{course.maxAttendees} spots</span>
              </div>
            )}
          </div>

          {/* Description */}
          {course.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">About this course</h2>
              <LessonContent content={course.description} />
            </div>
          )}

          {/* Registration CTA */}
          <div className="pt-6 border-t border-white/[0.06]">
            {course.registrationUrl && !isPast ? (
              <a
                href={course.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#D4836A] text-white rounded-xl font-semibold hover:bg-[#c4775f] transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                Register Now
              </a>
            ) : isPast ? (
              <p className="text-[#78716C]">This course has already taken place.</p>
            ) : (
              <p className="text-[#78716C]">Registration details coming soon.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
