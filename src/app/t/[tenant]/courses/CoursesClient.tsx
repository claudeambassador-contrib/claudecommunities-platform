"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { timezoneForCity } from "@/lib/cities";

interface ScheduledCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  city: string | null;
  timezone: string | null;
  startTime: string;
  endTime: string | null;
  isOnline: boolean;
  imageUrl: string | null;
  registrationUrl: string | null;
  courseType: string;
  price: string | null;
  instructor: string | null;
}

const courseTypeBadge: Record<string, string> = {
  workshop: "bg-purple-500/20 text-purple-400",
  bootcamp: "bg-blue-500/20 text-blue-400",
  webinar: "bg-amber-500/20 text-amber-400",
  seminar: "bg-green-500/20 text-green-400",
  training: "bg-rose-500/20 text-rose-400",
};

export default function CoursesClient({ initialCourses }: { initialCourses: ScheduledCourse[] }) {
  const config = useTenantConfig();
  const cities = useCities();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const formatDate = (course: ScheduledCourse) => {
    const tz =
      course.timezone || timezoneForCity(cities, course.city || "", config.defaultTimezone);
    return new Date(course.startTime).toLocaleDateString(config.lang, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });
  };

  const formatTime = (course: ScheduledCourse) => {
    const tz =
      course.timezone || timezoneForCity(cities, course.city || "", config.defaultTimezone);
    return new Date(course.startTime).toLocaleTimeString(config.lang, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
  };

  const now = new Date();
  const tabCourses =
    tab === "upcoming"
      ? initialCourses.filter((c) => new Date(c.startTime) > now)
      : initialCourses
          .filter((c) => new Date(c.startTime) <= now)
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const cityOptions = ["all", ...new Set(tabCourses.map((c) => c.city).filter(Boolean))];
  const courseTypes = ["all", ...new Set(tabCourses.map((c) => c.courseType).filter(Boolean))];

  let filtered = tabCourses;
  if (cityFilter !== "all") filtered = filtered.filter((c) => c.city === cityFilter);
  if (typeFilter !== "all") filtered = filtered.filter((c) => c.courseType === typeFilter);

  return (
    <>
      {/* Tabs */}
      <section className="px-6 mb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-1 bg-[#2a2a2a] rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => {
                setTab("upcoming");
                setCityFilter("all");
                setTypeFilter("all");
              }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "upcoming" ? "bg-[#D4836A] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("past");
                setCityFilter("all");
                setTypeFilter("all");
              }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "past" ? "bg-[#D4836A] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Past
            </button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 mb-8">
        <div className="max-w-6xl mx-auto space-y-3">
          {cityOptions.length > 2 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-400 text-sm">City:</span>
              {cityOptions.map((city) => (
                <button
                  type="button"
                  key={city || "all"}
                  onClick={() => setCityFilter(city || "all")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    cityFilter === city
                      ? "bg-[#D4836A] text-white"
                      : "bg-[#2a2a2a] text-gray-400 hover:text-white"
                  }`}
                >
                  {city === "all" ? "All Cities" : city}
                </button>
              ))}
            </div>
          )}
          {courseTypes.length > 2 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-400 text-sm">Type:</span>
              {courseTypes.map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
                    typeFilter === type
                      ? "bg-[#D4836A] text-white"
                      : "bg-[#2a2a2a] text-gray-400 hover:text-white"
                  }`}
                >
                  {type === "all" ? "All Types" : type}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Course Grid */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <p className="text-gray-400">
                {tab === "upcoming" ? "No upcoming courses" : "No past courses"}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {tab === "upcoming"
                  ? "Check back soon for scheduled workshops and training!"
                  : "Past courses will appear here after they've taken place."}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((course) => (
                <TenantLink
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="bg-[#2a2a2a] rounded-xl overflow-hidden border border-[#333] hover:border-[#D4836A]/50 transition-colors"
                >
                  {/* Image */}
                  <div className="h-40 bg-gradient-to-br from-[#D4836A]/20 to-[#333] flex items-center justify-center">
                    {course.imageUrl ? (
                      <RemoteImage
                        src={course.imageUrl}
                        alt={course.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <svg
                        className="w-16 h-16 text-[#D4836A]/50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="p-5">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="px-3 py-1 bg-[#D4836A]/20 text-[#D4836A] rounded-full text-xs font-medium">
                        {formatDate(course)}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${courseTypeBadge[course.courseType] || "bg-[#D4836A]/20 text-[#D4836A]"}`}
                      >
                        {course.courseType}
                      </span>
                      {course.isOnline && (
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                          Online
                        </span>
                      )}
                    </div>

                    <h3 className="text-white font-semibold text-lg mb-2">{course.title}</h3>

                    {course.description && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {course.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{formatTime(course)}</span>
                      </div>
                      {course.location && (
                        <div className="flex items-center gap-2">
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
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>{course.location}</span>
                        </div>
                      )}
                      {course.instructor && (
                        <div className="flex items-center gap-2">
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span>{course.instructor}</span>
                        </div>
                      )}
                      {course.price && (
                        <div className="text-[#D4836A] font-medium">{course.price}</div>
                      )}
                    </div>

                    <div className="mt-4">
                      {course.registrationUrl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(course.registrationUrl ?? undefined, "_blank");
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#D4836A] text-white rounded-lg hover:bg-[#c4775f] transition-colors font-medium text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Register
                        </button>
                      ) : (
                        <span className="w-full block text-center py-2.5 bg-[#D4836A] text-white rounded-lg hover:bg-[#c4775f] transition-colors font-medium">
                          View Details
                        </span>
                      )}
                    </div>
                  </div>
                </TenantLink>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
