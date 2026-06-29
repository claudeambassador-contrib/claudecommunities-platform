export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  Lock,
  Play,
  Users,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import EnrollButton from "@/components/EnrollButton";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

async function getCourse(slug: string, userId?: string) {
  const db = await getPrisma();
  const course = await db.course.findFirst({
    where: { slug },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        include: userId
          ? {
              progress: {
                where: { userId },
                select: { completed: true },
              },
            }
          : undefined,
      },
      enrollments: userId
        ? {
            where: { userId },
            select: { id: true, progress: true },
          }
        : undefined,
      requiredTier: true,
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!course?.isPublished) return null;

  return {
    ...course,
    isEnrolled:
      userId && course.enrollments
        ? (course.enrollments as { progress: number }[]).length > 0
        : false,
    enrollmentProgress:
      (userId && (course.enrollments as { progress: number }[] | undefined)?.[0]?.progress) || 0,
    lessons: course.lessons.map((lesson) => ({
      ...lesson,
      isCompleted:
        (lesson as { progress?: { completed: boolean }[] }).progress?.[0]?.completed || false,
    })),
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const { slug } = await params;
  const userId = user.id;
  const course = await getCourse(slug, userId);

  if (!course) {
    notFound();
  }

  const completedLessons = course.lessons.filter((l) => l.isCompleted).length;
  const progressPercent =
    course.lessons.length > 0 ? Math.round((completedLessons / course.lessons.length) * 100) : 0;

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

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <TenantLink
            href="/community/learn"
            className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to courses
          </TenantLink>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Thumbnail */}
            <div className="md:w-80 shrink-0">
              {course.thumbnail ? (
                <div className="aspect-video rounded-xl overflow-hidden">
                  <RemoteImage
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-xl bg-gradient-to-br from-[#D4836A]/20 to-[#2D2926] flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-[#D4836A]/50" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
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

              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">{course.title}</h1>

              {course.description && <p className="text-[#A8A29E] mb-4">{course.description}</p>}

              <div className="flex flex-wrap items-center gap-4 text-sm text-[#78716C] mb-6">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {course.lessons.length} lessons
                </span>
                {course.duration && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {course.duration}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {course._count.enrollments} enrolled
                </span>
              </div>

              {course.isEnrolled ? (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D4836A] rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-sm text-[#A8A29E] font-medium">{progressPercent}%</span>
                  </div>
                  <p className="text-sm text-[#78716C]">
                    {completedLessons} of {course.lessons.length} lessons completed
                  </p>
                </div>
              ) : (
                <EnrollButton courseId={course.id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lessons */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#D4836A]" />
          Course Content
        </h2>

        <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
          {course.lessons.map((lesson, index) => {
            const canAccess = course.isEnrolled || lesson.isPreview;

            return (
              <div key={lesson.id} className="group">
                {canAccess ? (
                  <TenantLink
                    href={`/community/learn/${course.slug}/${lesson.slug}`}
                    className="flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        lesson.isCompleted ? "bg-green-500/20" : "bg-white/[0.05]"
                      }`}
                    >
                      {lesson.isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Play className="w-4 h-4 text-[#D4836A] ml-0.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#78716C]">Lesson {index + 1}</span>
                        {lesson.isPreview && !course.isEnrolled && (
                          <span className="px-1.5 py-0.5 text-xs bg-[#D4836A]/20 text-[#D4836A] rounded">
                            Preview
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-medium group-hover:text-[#D4836A] transition-colors truncate">
                        {lesson.title}
                      </h3>
                    </div>
                    {lesson.duration && (
                      <span className="text-sm text-[#78716C] shrink-0">{lesson.duration}</span>
                    )}
                  </TenantLink>
                ) : (
                  <div className="flex items-center gap-4 p-5 opacity-60">
                    <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4 text-[#78716C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[#78716C]">Lesson {index + 1}</span>
                      <h3 className="text-white font-medium truncate">{lesson.title}</h3>
                    </div>
                    {lesson.duration && (
                      <span className="text-sm text-[#78716C] shrink-0">{lesson.duration}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {course.lessons.length === 0 && (
          <div className="text-center py-12 bg-[#2D2926] rounded-2xl border border-white/[0.06]">
            <BookOpen className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
            <p className="text-[#78716C]">No lessons available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
