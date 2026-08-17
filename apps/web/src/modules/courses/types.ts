export interface LessonInput {
  content?: string | null;
  id?: string;
  order?: number;
  title: string;
}

export interface CourseCreateBody {
  description?: string | null;
  isPublished?: boolean;
  lessons?: LessonInput[];
  slug: string;
  title: string;
}

export type CourseUpdateBody = Partial<CourseCreateBody>;

export interface LessonDetail {
  content: string | null;
  id: string;
  order: number;
  title: string;
}

export interface CourseDetail {
  description: string | null;
  enrolled: boolean;
  enrollmentCount: number;
  id: string;
  lessons: LessonDetail[];
  slug: string;
  status: "draft" | "published";
  title: string;
}

export interface CourseListItem {
  enrollmentCount: number;
  id: string;
  lessonCount: number;
  slug: string;
  status: "draft" | "published";
  title: string;
}
