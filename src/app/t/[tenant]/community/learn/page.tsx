export const dynamic = "force-dynamic";

import {
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  Play,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { stripMarkdown } from "@/lib/strip-markdown";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantConfig } from "@/lib/tenant-config";

async function getCourses(userId?: string) {
  const db = await getPrisma();
  const courses = await db.course.findMany({
    where: { isPublished: true },
    include: {
      lessons: {
        select: { id: true },
      },
      enrollments: userId
        ? {
            where: { userId },
            select: { id: true, progress: true, completedAt: true },
          }
        : undefined,
      requiredTier: {
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { order: "asc" },
  });

  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail: course.thumbnail,
    duration: course.duration,
    difficulty: course.difficulty,
    isFree: course.isFree,
    lessonCount: course.lessons.length,
    enrollmentCount: course._count.enrollments,
    requiredTier: course.requiredTier,
    isEnrolled:
      userId && course.enrollments
        ? (course.enrollments as { progress: number; completedAt: Date | null }[]).length > 0
        : false,
    progress:
      (userId &&
        (course.enrollments as { progress: number; completedAt: Date | null }[] | undefined)?.[0]
          ?.progress) ||
      0,
    isCompleted: !!(
      userId &&
      (course.enrollments as { progress: number; completedAt: Date | null }[] | undefined)?.[0]
        ?.completedAt
    ),
  }));
}

async function getUpcomingScheduledCourses() {
  const db = await getPrisma();
  return await db.scheduledCourse.findMany({
    where: {
      isPublished: true,
      startTime: { gt: new Date() },
    },
    orderBy: { startTime: "asc" },
    take: 6,
  });
}

const courseTypeBadge: Record<string, string> = {
  workshop: "bg-purple-500/20 text-purple-400",
  bootcamp: "bg-blue-500/20 text-blue-400",
  webinar: "bg-amber-500/20 text-amber-400",
  seminar: "bg-green-500/20 text-green-400",
  training: "bg-rose-500/20 text-rose-400",
};

async function getUserTier(userId: string) {
  const db = await getPrisma();
  const subscription = await db.subscription.findFirst({
    where: {
      userId,
      status: "active",
    },
    include: {
      tier: true,
    },
  });
  return subscription?.tier || null;
}

export default async function LearnPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const userId = user.id;
  const [courses, userTier, scheduledCourses, tenantConfig] = await Promise.all([
    getCourses(userId),
    userId ? getUserTier(userId) : Promise.resolve(null),
    getUpcomingScheduledCourses(),
    getTenantConfig(),
  ]);

  const enrolledCourses = courses.filter((c) => c.isEnrolled);
  const availableCourses = courses.filter((c) => !c.isEnrolled);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-500/20 text-green-400";
      case "intermediate":
        return "bg-yellow-500/20 text-yellow-400";
      case "advanced":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const canAccessCourse = (course: (typeof courses)[0]) => {
    if (course.isFree) return true;
    if (!course.requiredTier) return true;
    if (!userTier) return false;
    // Simple tier check - in production you'd compare tier levels
    return true;
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#D4836A]/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-[#D4836A]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Learning Hub</h1>
              <p className="text-[#A8A29E]">
                Free self-paced modules and scheduled courses & workshops
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Continue Learning */}
        {enrolledCourses.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Play className="w-5 h-5 text-[#D4836A]" />
              Continue Learning
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((course) => (
                <TenantLink
                  key={course.id}
                  href={`/community/learn/${course.slug}`}
                  className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-[#D4836A]/30 transition-all group"
                >
                  {course.thumbnail ? (
                    <div className="aspect-video bg-[#1C1917] relative">
                      <RemoteImage
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#D4836A] rounded-full transition-all"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-white font-medium">{course.progress}%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-[#D4836A]/20 to-[#1C1917] flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-[#D4836A]/50" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold text-white group-hover:text-[#D4836A] transition-colors mb-2">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-[#78716C]">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {course.lessonCount} lessons
                      </span>
                      {course.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {course.duration}
                        </span>
                      )}
                    </div>
                  </div>
                </TenantLink>
              ))}
            </div>
          </section>
        )}

        {/* Available Courses */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#8B5CF6]" />
            Learning Modules
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
              Free · Self-paced
            </span>
          </h2>
          {availableCourses.length === 0 ? (
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-12 text-center">
              <BookOpen className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No learning modules yet</h3>
              <p className="text-[#78716C]">Self-paced modules will appear here when available.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableCourses.map((course) => {
                const hasAccess = canAccessCourse(course);
                return (
                  <TenantLink
                    key={course.id}
                    href={hasAccess ? `/community/learn/${course.slug}` : `/pricing`}
                    className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-[#D4836A]/30 transition-all group relative"
                  >
                    {!hasAccess && (
                      <div className="absolute top-4 right-4 z-10">
                        <div className="px-2 py-1 bg-[#1C1917]/90 rounded-lg flex items-center gap-1 text-xs text-[#A8A29E]">
                          <Lock className="w-3 h-3" />
                          {course.requiredTier?.name || "Premium"}
                        </div>
                      </div>
                    )}
                    {course.thumbnail ? (
                      <div className="aspect-video bg-[#1C1917]">
                        <RemoteImage
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-[#8B5CF6]/20 to-[#1C1917] flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-[#8B5CF6]/50" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getDifficultyColor(course.difficulty)}`}
                        >
                          {course.difficulty}
                        </span>
                        {course.isFree && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                            Free
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-white group-hover:text-[#D4836A] transition-colors mb-2">
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="text-sm text-[#78716C] line-clamp-2 mb-3">
                          {stripMarkdown(course.description)}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-[#78716C]">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {course.lessonCount} lessons
                          </span>
                          {course.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {course.duration}
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {course.enrollmentCount}
                        </span>
                      </div>
                    </div>
                  </TenantLink>
                );
              })}
            </div>
          )}
        </section>

        {/* Scheduled Courses & Workshops */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#D4836A]" />
              Upcoming Courses & Workshops
            </h2>
            <TenantLink
              href="/courses"
              className="text-sm text-[#D4836A] hover:text-[#c4775f] flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </TenantLink>
          </div>

          {scheduledCourses.length === 0 ? (
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-12 text-center">
              <Calendar className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No upcoming courses</h3>
              <p className="text-[#78716C]">
                Check back soon for scheduled workshops and training!
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scheduledCourses.map((course) => (
                <TenantLink
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-[#D4836A]/30 transition-all group"
                >
                  {course.imageUrl ? (
                    <div className="aspect-video bg-[#1C1917]">
                      <RemoteImage
                        src={course.imageUrl}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-[#D4836A]/20 to-[#1C1917] flex items-center justify-center">
                      <Calendar className="w-12 h-12 text-[#D4836A]/50" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${courseTypeBadge[course.courseType] || "bg-[#D4836A]/20 text-[#D4836A]"}`}
                      >
                        {course.courseType}
                      </span>
                      {course.isOnline && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
                          Online
                        </span>
                      )}
                      {course.price ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#D4836A]/20 text-[#D4836A]">
                          {course.price}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                          Free
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white group-hover:text-[#D4836A] transition-colors mb-2">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-sm text-[#78716C] line-clamp-2 mb-3">
                        {stripMarkdown(course.description)}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#78716C]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(course.startTime).toLocaleDateString(tenantConfig.lang, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: course.timezone || tenantConfig.defaultTimezone,
                        })}
                      </span>
                      {course.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {course.city}
                        </span>
                      )}
                      {course.instructor && (
                        <span className="text-[#57534E]">by {course.instructor}</span>
                      )}
                    </div>
                    {course.registrationUrl && (
                      <div className="mt-4">
                        <a
                          href={course.registrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-2 bg-[#D4836A] text-white rounded-lg hover:bg-[#c4775f] transition-colors font-medium text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Register
                        </a>
                      </div>
                    )}
                  </div>
                </TenantLink>
              ))}
            </div>
          )}
        </section>

        {courses.length === 0 && scheduledCourses.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-[#78716C] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No learning content yet</h3>
            <p className="text-[#78716C]">Check back soon for new modules and courses!</p>
          </div>
        )}
      </div>
    </div>
  );
}
