export const dynamic = "force-dynamic";

import { BookOpen, Calendar, Eye, Plus, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ScheduledCoursesTab from "./ScheduledCoursesTab";

async function getCourses() {
  const db = await getPrisma();
  return await db.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { lessons: true, enrollments: true } },
    },
  });
}

async function getScheduledCourses() {
  const db = await getPrisma();
  return await db.scheduledCourse.findMany({
    orderBy: { startTime: "asc" },
  });
}

export default async function AdminCoursesPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "courses.view"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  const [courses, scheduledCourses] = await Promise.all([getCourses(), getScheduledCourses()]);

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Actions */}
        <Can permission="courses.edit">
          <div className="flex items-center justify-end mb-8">
            <TenantLink
              href="/admin/courses/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Course
            </TenantLink>
          </div>
        </Can>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#D4836A]/20 flex items-center justify-center text-[#D4836A]">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{courses.length}</p>
            <p className="text-sm text-[#78716C]">Learning Modules</p>
          </div>
          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6]">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {scheduledCourses.filter((c) => c.startTime > new Date()).length}
            </p>
            <p className="text-sm text-[#78716C]">Upcoming Scheduled</p>
          </div>
          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {courses.filter((c) => c.isPublished).length +
                scheduledCourses.filter((c) => c.isPublished).length}
            </p>
            <p className="text-sm text-[#78716C]">Published</p>
          </div>
          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#D4836A]/20 flex items-center justify-center text-[#D4836A]">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {courses.reduce((acc, c) => acc + c._count.enrollments, 0)}
            </p>
            <p className="text-sm text-[#78716C]">Total Enrollments</p>
          </div>
        </div>

        {/* Tabs handled by client component */}
        <ScheduledCoursesTab
          courses={JSON.parse(JSON.stringify(courses))}
          scheduledCourses={JSON.parse(JSON.stringify(scheduledCourses))}
        />
      </div>
    </div>
  );
}
