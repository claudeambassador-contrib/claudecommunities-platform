"use client";

import { BookOpen, Calendar, Edit, ExternalLink, Eye, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { RemoteImage } from "@/components/ui/RemoteImage";

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  isPublished: boolean;
  _count: { lessons: number; enrollments: number };
}

interface ScheduledCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  city: string | null;
  courseType: string;
  startTime: string;
  isPublished: boolean;
  isOnline: boolean;
  registrationUrl: string | null;
  imageUrl: string | null;
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

export default function ScheduledCoursesTab({
  courses: initialCourses,
  scheduledCourses: initialScheduled,
}: {
  courses: Course[];
  scheduledCourses: ScheduledCourse[];
}) {
  const config = useTenantConfig();
  const [courses, setCourses] = useState(initialCourses);
  const [scheduledCourses, setScheduledCourses] = useState(initialScheduled);
  const [showPast, setShowPast] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const now = new Date();
  const upcomingScheduled = scheduledCourses.filter((c) => new Date(c.startTime) > now);
  const pastScheduled = scheduledCourses.filter((c) => new Date(c.startTime) <= now);
  const visibleScheduled = showPast ? scheduledCourses : upcomingScheduled;

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this scheduled course?")) return;

    try {
      const res = await fetch(`/api/scheduled-courses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setScheduledCourses((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete scheduled course:", error);
    }
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      const res = await fetch(`/api/admin/courses/${courseToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id));
      }
    } catch (error) {
      console.error("Failed to delete course:", error);
    } finally {
      setCourseToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(config.lang, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      {/* Learning Modules Card */}
      <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#D4836A]" />
            Learning Modules ({courses.length})
          </h2>
          <Can permission="courses.edit">
            <TenantLink
              href="/admin/courses/new"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Module
            </TenantLink>
          </Can>
        </div>

        {courses.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-[#57534E] mx-auto mb-4" />
            <p className="text-[#78716C] mb-4">No learning modules created yet</p>
            <Can permission="courses.edit">
              <TenantLink
                href="/admin/courses/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Module
              </TenantLink>
            </Can>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {courses.map((course) => (
              <div key={course.id} className="p-4 hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-[#1C1917] flex items-center justify-center shrink-0">
                    {course.thumbnail ? (
                      <RemoteImage
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <BookOpen className="w-6 h-6 text-[#57534E]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white truncate">{course.title}</h3>
                      {course.isPublished ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#78716C] truncate">
                      {course.description || "No description"}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#57534E]">
                      <span>{course._count.lessons} lessons</span>
                      <span>{course._count.enrollments} enrolled</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TenantLink
                      href={`/community/learn/${course.slug}`}
                      className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </TenantLink>
                    <Can permission="courses.edit">
                      <TenantLink
                        href={`/admin/courses/${course.id}/edit`}
                        className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </TenantLink>
                    </Can>
                    <Can permission="courses.delete">
                      <button
                        type="button"
                        onClick={() => setCourseToDelete(course)}
                        className="p-2 rounded-lg text-[#78716C] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Can>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Courses Card */}
      <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D4836A]" />
              Scheduled Courses ({upcomingScheduled.length} upcoming
              {pastScheduled.length > 0 ? `, ${pastScheduled.length} past` : ""})
            </h2>
            {pastScheduled.length > 0 && (
              <ToggleSwitch checked={showPast} onChange={setShowPast} label="Show past" />
            )}
          </div>
          <Can permission="courses.edit">
            <TenantLink
              href="/admin/courses/new?type=scheduled"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Scheduled Course
            </TenantLink>
          </Can>
        </div>

        {visibleScheduled.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-[#57534E] mx-auto mb-4" />
            <p className="text-[#78716C] mb-4">
              {scheduledCourses.length === 0
                ? "No scheduled courses yet"
                : "No upcoming scheduled courses"}
            </p>
            <Can permission="courses.edit">
              <TenantLink
                href="/admin/courses/new?type=scheduled"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create a Scheduled Course
              </TenantLink>
            </Can>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {visibleScheduled.map((course) => {
              const isPast = new Date(course.startTime) <= now;
              return (
                <div
                  key={course.id}
                  className={`p-4 hover:bg-white/[0.02] ${isPast ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Date badge */}
                    <div className="w-16 h-16 bg-[#D4836A]/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[#D4836A] font-bold text-lg leading-none">
                        {new Date(course.startTime).getDate()}
                      </span>
                      <span className="text-[#D4836A]/70 text-xs uppercase">
                        {new Date(course.startTime).toLocaleDateString(config.lang, {
                          month: "short",
                        })}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-white truncate">{course.title}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${courseTypeBadge[course.courseType] || "bg-[#D4836A]/20 text-[#D4836A]"}`}
                        >
                          {course.courseType}
                        </span>
                        {course.isPublished ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                            Draft
                          </span>
                        )}
                        {isPast && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-[#78716C]">
                            Past
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-[#78716C]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(course.startTime)}
                        </span>
                        {course.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {course.city}
                          </span>
                        )}
                        {course.instructor && (
                          <span className="text-[#57534E]">by {course.instructor}</span>
                        )}
                        {course.price && <span className="text-[#D4836A]">{course.price}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/courses/${course.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      {course.registrationUrl && (
                        <a
                          href={course.registrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-[#78716C] hover:text-[#D4836A] hover:bg-[#D4836A]/10 rounded-lg transition-colors"
                          title="Registration link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Can permission="courses.edit">
                        <TenantLink
                          href={`/admin/courses/new?edit=${course.id}`}
                          className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </TenantLink>
                      </Can>
                      <Can permission="courses.delete">
                        <button
                          type="button"
                          onClick={() => handleDelete(course.id)}
                          className="p-2 rounded-lg text-[#78716C] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Can>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!courseToDelete}
        variant="destructive"
        title="Delete course?"
        description={
          courseToDelete
            ? `"${courseToDelete.title}" and its ${courseToDelete._count.lessons} lesson(s) will be permanently deleted${
                courseToDelete._count.enrollments > 0
                  ? `, along with ${courseToDelete._count.enrollments} enrollment(s) and their progress`
                  : ""
              }. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={confirmDeleteCourse}
        onCancel={() => setCourseToDelete(null)}
      />
    </div>
  );
}
