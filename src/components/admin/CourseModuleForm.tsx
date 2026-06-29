"use client";

import { GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import LessonContent from "@/components/LessonContent";

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  videoUrl: string;
  order: number;
}

export interface CourseModuleFields {
  title: string;
  slug: string;
  description: string;
  thumbnail: string;
  isPublished: boolean;
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Presentational form for a learning-module course (details + lessons).
 * Shared by the create page (`/admin/courses/new`) and the edit page
 * (`/admin/courses/[id]/edit`); the parent owns state + submit.
 */
export default function CourseModuleForm({
  course,
  onCourseChange,
  lessons,
  onLessonsChange,
  saving,
  onSubmit,
  submitLabel,
  autoSlug = false,
}: {
  course: CourseModuleFields;
  onCourseChange: (next: CourseModuleFields) => void;
  lessons: Lesson[];
  onLessonsChange: (next: Lesson[]) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  autoSlug?: boolean;
}) {
  const [lessonPreviewIndex, setLessonPreviewIndex] = useState<number | null>(null);

  const handleTitleChange = (title: string) => {
    onCourseChange({
      ...course,
      title,
      ...(autoSlug ? { slug: generateSlug(title) } : {}),
    });
  };

  const addLesson = () => {
    onLessonsChange([
      ...lessons,
      {
        id: `temp-${crypto.randomUUID()}`,
        title: "",
        description: "",
        content: "",
        videoUrl: "",
        order: lessons.length + 1,
      },
    ]);
  };

  const updateLesson = (index: number, updates: Partial<Lesson>) => {
    onLessonsChange(lessons.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  };

  const removeLesson = (index: number) => {
    onLessonsChange(lessons.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex justify-end mb-4">
        <button
          type="submit"
          disabled={saving || !course.title}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitLabel}
        </button>
      </div>

      <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6 mb-6">
        <h2 className="font-semibold text-white mb-4">Course Details</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-[#A8A29E] mb-1">
              Title
            </label>
            <input
              id="course-title"
              type="text"
              value={course.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g., Getting Started with Claude"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
              required
            />
          </div>
          <div>
            <label htmlFor="course-slug" className="block text-sm font-medium text-[#A8A29E] mb-1">
              Slug
            </label>
            <input
              id="course-slug"
              type="text"
              value={course.slug}
              onChange={(e) => onCourseChange({ ...course, slug: e.target.value })}
              placeholder="getting-started-with-claude-code"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A] font-mono text-sm"
              required
            />
          </div>
          <div>
            <label
              htmlFor="course-description"
              className="block text-sm font-medium text-[#A8A29E] mb-1"
            >
              Description
            </label>
            <textarea
              id="course-description"
              value={course.description}
              onChange={(e) => onCourseChange({ ...course, description: e.target.value })}
              placeholder="What will students learn in this course?"
              rows={3}
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A] resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="course-thumbnail"
              className="block text-sm font-medium text-[#A8A29E] mb-1"
            >
              Thumbnail URL (optional)
            </label>
            <input
              id="course-thumbnail"
              type="url"
              value={course.thumbnail}
              onChange={(e) => onCourseChange({ ...course, thumbnail: e.target.value })}
              placeholder="https://example.com/thumbnail.jpg"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={course.isPublished}
              onChange={(e) => onCourseChange({ ...course, isPublished: e.target.checked })}
              className="w-5 h-5 rounded border-white/20 bg-[#1C1917] text-[#D4836A] focus:ring-[#D4836A] focus:ring-offset-0"
            />
            <span className="text-white">Publish immediately</span>
          </label>
        </div>
      </div>

      {/* Lessons */}
      <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Lessons</h2>
          <button
            type="button"
            onClick={addLesson}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white/[0.05] text-[#A8A29E] rounded-lg hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lesson
          </button>
        </div>

        {lessons.length === 0 ? (
          <div className="text-center py-8 text-[#78716C]">
            <p className="mb-4">No lessons added yet</p>
            <button
              type="button"
              onClick={addLesson}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Lesson
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson, index) => (
              <div
                key={lesson.id}
                className="bg-[#1C1917] rounded-xl p-4 border border-white/[0.06]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-2">
                    <GripVertical className="w-5 h-5 text-[#57534E] cursor-grab" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#D4836A]/20 text-[#D4836A] text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={lesson.title}
                        onChange={(e) => updateLesson(index, { title: e.target.value })}
                        placeholder="Lesson title"
                        className="flex-1 px-3 py-2 bg-[#2D2926] border border-white/[0.06] rounded-lg text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
                        required
                      />
                    </div>
                    <input
                      type="text"
                      value={lesson.description}
                      onChange={(e) => updateLesson(index, { description: e.target.value })}
                      placeholder="Brief description (optional)"
                      className="w-full px-3 py-2 bg-[#2D2926] border border-white/[0.06] rounded-lg text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A] text-sm"
                    />
                    <div>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setLessonPreviewIndex(null)}
                          className={`px-3 py-1 text-xs rounded-lg ${lessonPreviewIndex !== index ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setLessonPreviewIndex(index)}
                          className={`px-3 py-1 text-xs rounded-lg ${lessonPreviewIndex === index ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
                        >
                          Preview
                        </button>
                      </div>
                      {lessonPreviewIndex === index ? (
                        <div className="min-h-[100px] px-3 py-2 bg-[#2D2926] border border-white/[0.06] rounded-lg">
                          {lesson.content ? (
                            <LessonContent content={lesson.content} />
                          ) : (
                            <p className="text-[#57534E] text-sm italic">Nothing to preview</p>
                          )}
                        </div>
                      ) : (
                        <textarea
                          value={lesson.content}
                          onChange={(e) => updateLesson(index, { content: e.target.value })}
                          placeholder="Lesson content (supports markdown)"
                          rows={4}
                          className="w-full px-3 py-2 bg-[#2D2926] border border-white/[0.06] rounded-lg text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A] text-sm font-mono resize-none"
                        />
                      )}
                    </div>
                    <input
                      type="url"
                      value={lesson.videoUrl}
                      onChange={(e) => updateLesson(index, { videoUrl: e.target.value })}
                      placeholder="Video URL (optional, e.g., YouTube embed)"
                      className="w-full px-3 py-2 bg-[#2D2926] border border-white/[0.06] rounded-lg text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A] text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLesson(index)}
                    className="p-2 text-[#78716C] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
