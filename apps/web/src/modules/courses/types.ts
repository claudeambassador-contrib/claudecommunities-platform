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

export interface ScheduledCourseInput {
  city?: string | null;
  courseType?: string;
  description?: string | null;
  endTime?: string | null;
  imageUrl?: string | null;
  instructor?: string | null;
  isOnline?: boolean;
  isPublished?: boolean;
  location?: string | null;
  maxAttendees?: number | null;
  meetingUrl?: string | null;
  price?: string | null;
  registrationUrl?: string | null;
  startTime: string;
  timezone?: string | null;
  title: string;
}

export type ScheduledCourseUpdate = Partial<ScheduledCourseInput>;

/** Persistence write DTO — dates stay as Date only inside the repository. */
export interface ScheduledCourseWrite {
  city?: string | null;
  courseType?: string;
  description?: string | null;
  endTime?: Date | null;
  imageUrl?: string | null;
  instructor?: string | null;
  isOnline?: boolean;
  isPublished?: boolean;
  location?: string | null;
  maxAttendees?: number | null;
  meetingUrl?: string | null;
  price?: string | null;
  registrationUrl?: string | null;
  slug: string;
  startTime: Date;
  timezone?: string | null;
  title: string;
}

export interface ScheduledCourseDetail {
  city: string | null;
  courseType: string;
  description: string | null;
  endTime: string | null;
  id: string;
  imageUrl: string | null;
  instructor: string | null;
  isOnline: boolean;
  isPublished: boolean;
  location: string | null;
  maxAttendees: number | null;
  meetingUrl: string | null;
  price: string | null;
  registrationUrl: string | null;
  slug: string;
  startTime: string;
  timezone: string | null;
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
