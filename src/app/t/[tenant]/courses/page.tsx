// ISR: cached render served from the edge (no Worker render on a hit). Refreshed
// on course writes via revalidatePath("/courses") in courses.ts /
// scheduled-courses.ts; the 5-min window is the backstop. Same for all viewers.
export const revalidate = 300;

import { ArrowRight, BookOpen, Clock, Play, Users } from "lucide-react";
import type { Metadata } from "next";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getPrisma } from "@/lib/prisma";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";
import CoursesClient from "./CoursesClient";

export async function generateMetadata(): Promise<Metadata> {
  const { communityName, countryName } = await getTenantConfig();
  const SITE_URL = await siteUrl();

  return {
    title: `Courses & Workshops | ${communityName}`,
    description: `Find Claude Code workshops, bootcamps, and training courses across ${countryName}. Learn AI-powered coding with hands-on scheduled courses.`,
    keywords: [
      "Claude Code courses",
      "Claude Code workshops",
      "Claude training",
      `AI workshops ${countryName}`,
      "Claude bootcamp",
    ],
    openGraph: {
      title: `Courses & Workshops | ${communityName}`,
      description: `Find Claude Code workshops, bootcamps, and training courses across ${countryName}.`,
      url: `${SITE_URL}/courses`,
    },
    alternates: {
      canonical: `${SITE_URL}/courses`,
    },
  };
}

async function getScheduledCourses() {
  const db = await getPrisma();
  try {
    const courses = await db.scheduledCourse.findMany({
      where: { isPublished: true },
      orderBy: { startTime: "asc" },
    });
    return courses;
  } catch (error) {
    console.error("Failed to fetch scheduled courses:", error);
    return [];
  }
}

async function getSelfPacedCourses() {
  const db = await getPrisma();
  try {
    const courses = await db.course.findMany({
      where: { isPublished: true },
      include: {
        lessons: { select: { id: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { order: "asc" },
    });
    return courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      thumbnail: c.thumbnail,
      duration: c.duration,
      difficulty: c.difficulty,
      isFree: c.isFree,
      lessonCount: c.lessons.length,
      enrollmentCount: c._count.enrollments,
    }));
  } catch (error) {
    console.error("Failed to fetch self-paced courses:", error);
    return [];
  }
}

export default async function CoursesPage() {
  const [scheduledCourses, selfPacedCourses] = await Promise.all([
    getScheduledCourses(),
    getSelfPacedCourses(),
  ]);

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#D4836A]/20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-[#D4836A]"
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
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Courses & Workshops</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Level up your AI skills with scheduled workshops, bootcamps, and training sessions led
            by experts in the Claude Code community.
          </p>
        </div>
      </section>

      {/* Self-paced Learning Modules */}
      {selfPacedCourses.length > 0 && (
        <section className="px-6 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Play className="w-6 h-6 text-[#D4836A]" />
                  Self-paced Learning
                </h2>
                <p className="text-[#A8A29E] mt-1">
                  Interactive courses you can take at your own pace
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selfPacedCourses.map((course) => (
                <TenantLink
                  key={course.id}
                  href="/login?redirect_url=/community/learn"
                  className="group bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-[#D4836A]/30 transition-all"
                >
                  <div className="aspect-video bg-gradient-to-br from-[#2D2926] to-[#1C1917] flex items-center justify-center relative">
                    {course.thumbnail ? (
                      <RemoteImage
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen className="w-12 h-12 text-[#D4836A]/40" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-[#D4836A]/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#D4836A]/20 text-[#D4836A]">
                        {course.difficulty}
                      </span>
                      {course.isFree && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          Free
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-[#D4836A] transition-colors mb-2">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-[#A8A29E] text-sm line-clamp-2 mb-4">
                        {course.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm text-[#78716C]">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {course.lessonCount} lessons
                        </span>
                        {course.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {course.duration}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {course.enrollmentCount}
                      </span>
                    </div>
                  </div>
                </TenantLink>
              ))}
            </div>

            <div className="mt-6 text-center">
              <TenantLink
                href="/login?redirect_url=/community/learn"
                className="inline-flex items-center gap-2 text-[#D4836A] hover:text-[#c4775f] transition-colors text-sm font-medium"
              >
                Join the community to access all courses
                <ArrowRight className="w-4 h-4" />
              </TenantLink>
            </div>
          </div>
        </section>
      )}

      <CoursesClient initialCourses={JSON.parse(JSON.stringify(scheduledCourses))} />
    </>
  );
}
