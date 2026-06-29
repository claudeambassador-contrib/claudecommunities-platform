export const dynamic = "force-dynamic";

import { ArrowLeft, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import LessonContent from "@/components/LessonContent";
import MarkCompleteButton from "@/components/MarkCompleteButton";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

async function getCourseWithLesson(courseSlug: string, lessonSlug: string, userId?: string) {
  const db = await getPrisma();
  const course = await db.course.findFirst({
    where: { slug: courseSlug },
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
            select: { id: true },
          }
        : undefined,
    },
  });

  if (!course?.isPublished) return null;

  const lesson = course.lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) return null;

  const isEnrolled = userId && course.enrollments ? course.enrollments.length > 0 : false;
  const canAccess = isEnrolled || lesson.isPreview;

  if (!canAccess) return null;

  const lessonIndex = course.lessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null;

  return {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      lessons: course.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        slug: l.slug,
        duration: l.duration,
        isCompleted:
          (l as { progress?: { completed: boolean }[] }).progress?.[0]?.completed || false,
      })),
    },
    lesson: {
      ...lesson,
      isCompleted:
        (lesson as { progress?: { completed: boolean }[] }).progress?.[0]?.completed || false,
    },
    prevLesson: prevLesson ? { slug: prevLesson.slug, title: prevLesson.title } : null,
    nextLesson: nextLesson ? { slug: nextLesson.slug, title: nextLesson.title } : null,
    isEnrolled,
    lessonIndex: lessonIndex + 1,
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lesson: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const { slug, lesson: lessonSlug } = await params;
  const userId = user.id;
  const data = await getCourseWithLesson(slug, lessonSlug, userId);

  if (!data) {
    notFound();
  }

  const { course, lesson, prevLesson, nextLesson, isEnrolled, lessonIndex } = data;

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="border-b border-white/[0.06] px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <TenantLink
            href={`/community/learn/${course.slug}`}
            className="flex items-center gap-2 text-[#A8A29E] hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {course.title}
          </TenantLink>
          <div className="flex items-center gap-2 text-sm text-[#78716C]">
            {course.lessons.map((l, index) => {
              const isCurrent = l.id === lesson.id;
              return (
                <TenantLink
                  key={l.id}
                  href={`/community/learn/${course.slug}/${l.slug}`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    l.isCompleted
                      ? "bg-green-500/20 text-green-400"
                      : isCurrent
                        ? "bg-[#D4836A] text-white"
                        : "bg-white/[0.05] text-[#78716C] hover:bg-white/[0.1]"
                  }`}
                  title={l.title}
                >
                  {l.isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : index + 1}
                </TenantLink>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 text-sm text-[#78716C] mb-2">
              <span>
                Lesson {lessonIndex} of {course.lessons.length}
              </span>
              {lesson.duration && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {lesson.duration}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          {lesson.videoUrl && (
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-8">
              <video src={lesson.videoUrl} controls className="w-full h-full">
                <track kind="captions" srcLang="en" src="" default />
              </video>
            </div>
          )}

          <LessonContent
            content={lesson.content}
            lessonNumber={lessonIndex}
            lessonTitle={lesson.title}
            lessonDuration={lesson.duration || undefined}
            courseTitle={course.title}
          />

          <div className="flex items-center justify-between mt-12 pt-6 border-t border-white/[0.06]">
            {prevLesson ? (
              <TenantLink
                href={`/community/learn/${course.slug}/${prevLesson.slug}`}
                className="flex items-center gap-2 text-[#A8A29E] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <div>
                  <div className="text-xs text-[#78716C]">Previous</div>
                  <div className="text-sm">{prevLesson.title}</div>
                </div>
              </TenantLink>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-4">
              {isEnrolled && (
                <MarkCompleteButton lessonId={lesson.id} isCompleted={lesson.isCompleted} />
              )}
            </div>

            {nextLesson ? (
              <TenantLink
                href={`/community/learn/${course.slug}/${nextLesson.slug}`}
                className="flex items-center gap-2 text-[#A8A29E] hover:text-white transition-colors text-right"
              >
                <div>
                  <div className="text-xs text-[#78716C]">Next</div>
                  <div className="text-sm">{nextLesson.title}</div>
                </div>
                <ArrowRight className="w-4 h-4" />
              </TenantLink>
            ) : (
              <TenantLink
                href={`/community/learn/${course.slug}`}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg hover:bg-[#c4775f] transition-colors"
              >
                Complete Course
                <CheckCircle className="w-4 h-4" />
              </TenantLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
