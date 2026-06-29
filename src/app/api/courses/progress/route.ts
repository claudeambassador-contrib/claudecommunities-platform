import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant-context";

export async function POST(request: Request) {
  const db = await getPrisma();
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { lessonId, completed } = await request.json();

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
    }

    // Get the lesson and check enrollment
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          include: {
            enrollments: {
              where: { userId },
            },
            lessons: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const isEnrolled = lesson.course.enrollments.length > 0;
    if (!isEnrolled) {
      return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
    }

    // Update or create lesson progress
    const progress = await db.lessonProgress.upsert({
      where: {
        tenantId_userId_lessonId: { tenantId: await getTenantId(), userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        completed,
        completedAt: completed ? new Date() : null,
      },
      update: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    // Update course enrollment progress
    const completedLessons = await db.lessonProgress.count({
      where: {
        lessonId: { in: lesson.course.lessons.map((l) => l.id) },
        userId,
        completed: true,
      },
    });

    const totalLessons = lesson.course.lessons.length;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const isComplete = progressPercent === 100;

    await db.courseEnrollment.updateMany({
      where: { userId, courseId: lesson.courseId },
      data: {
        progress: progressPercent,
        completedAt: isComplete ? new Date() : null,
      },
    });

    // Record analytics event
    if (completed) {
      await db.analyticsEvent.create({
        data: {
          event: "lesson_completed",
          userId,
          data: JSON.stringify({
            lessonId,
            lessonTitle: lesson.title,
            courseId: lesson.courseId,
          }),
        },
      });
    }

    return NextResponse.json({ progress, courseProgress: progressPercent });
  } catch (error) {
    console.error("Failed to update progress:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
