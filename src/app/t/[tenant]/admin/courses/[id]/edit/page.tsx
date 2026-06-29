"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CourseModuleForm, {
  type CourseModuleFields,
  type Lesson,
} from "@/components/admin/CourseModuleForm";
import { TenantLink, useTenantRouter } from "@/components/TenantBaseProvider";

export default function EditCoursePage() {
  const router = useTenantRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseModuleFields>({
    title: "",
    slug: "",
    description: "",
    thumbnail: "",
    isPublished: false,
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/courses/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          if (active) {
            setLoadError(
              res.status === 403
                ? "You don't have permission to edit this course."
                : "Course not found.",
            );
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!active || !data) return;
        setCourse({
          title: data.title || "",
          slug: data.slug || "",
          description: data.description || "",
          thumbnail: data.thumbnail || "",
          isPublished: data.isPublished || false,
        });
        setLessons(
          (data.lessons || []).map((l: Record<string, unknown>, i: number) => ({
            id: String(l.id),
            title: (l.title as string) || "",
            description: "",
            content: (l.content as string) || "",
            videoUrl: (l.videoUrl as string) || "",
            order: (l.order as number) ?? i + 1,
          })),
        );
      })
      .catch(() => {
        if (active) setLoadError("Failed to load course.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.title,
          slug: course.slug,
          description: course.description,
          thumbnail: course.thumbnail,
          isPublished: course.isPublished,
          lessons: lessons.map((l, i) => ({
            id: l.id.startsWith("temp-") ? undefined : l.id,
            title: l.title,
            content: l.content,
            videoUrl: l.videoUrl || null,
            order: i + 1,
          })),
        }),
      });
      if (res.ok) {
        router.push("/admin/courses");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save course");
      }
    } catch {
      setSaveError("Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1917] pt-14">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <TenantLink
              href="/admin/courses"
              className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </TenantLink>
            <h1 className="text-2xl font-bold text-white">Edit Course</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[#78716C] py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading course…
          </div>
        ) : loadError ? (
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-8 text-center">
            <p className="text-[#A8A29E] mb-4">{loadError}</p>
            <TenantLink
              href="/admin/courses"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              Back to Courses
            </TenantLink>
          </div>
        ) : (
          <>
            {saveError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {saveError}
              </div>
            )}
            <CourseModuleForm
              course={course}
              onCourseChange={setCourse}
              lessons={lessons}
              onLessonsChange={setLessons}
              saving={saving}
              onSubmit={handleSubmit}
              submitLabel="Save Changes"
            />
          </>
        )}
      </div>
    </div>
  );
}
