import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import {
  enrollInCourse,
  getPublishedBySlug,
  getScheduledCourse,
} from "@/modules/courses/services/coursesService";
import { loadCityPage, requireCityActor } from "@/shared/http/cityPage";
import { EmptyCard, ItemList, PageHeader, SignInCard } from "@/shared/ui/page";

interface LessonItem {
  content: string | null;
  id: string;
  title: string;
}

type CourseView =
  | {
      kind: "course";
      course: {
        description: string | null;
        enrolled: boolean;
        enrollmentCount: number;
        id: string;
        lessons: LessonItem[];
        slug: string;
        title: string;
      };
      signedIn: boolean;
    }
  | {
      kind: "scheduled";
      course: {
        description: string | null;
        instructor: string | null;
        isOnline: boolean;
        location: string | null;
        registrationUrl: string | null;
        slug: string;
        startTime: string;
        title: string;
      };
      signedIn: boolean;
    }
  | { kind: "missing" };

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
  .handler(async ({ data }): Promise<CourseView> => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { kind: "missing" };
    }
    const published = await getPublishedBySlug(page.store, data.slug, page.actor);
    if (published.ok) {
      return {
        kind: "course",
        course: {
          description: published.course.description,
          enrolled: published.course.enrolled,
          enrollmentCount: published.course.enrollmentCount,
          id: published.course.id,
          lessons: published.course.lessons.map((lesson) => ({
            content: lesson.content,
            id: lesson.id,
            title: lesson.title,
          })),
          slug: published.course.slug,
          title: published.course.title,
        },
        signedIn: Boolean(page.actor),
      };
    }
    const scheduled = await getScheduledCourse(page.store, data.slug, page.actor);
    if (scheduled.ok) {
      return {
        kind: "scheduled",
        course: {
          description: scheduled.course.description,
          instructor: scheduled.course.instructor,
          isOnline: scheduled.course.isOnline,
          location: scheduled.course.location ?? scheduled.course.city,
          registrationUrl: scheduled.course.registrationUrl,
          slug: scheduled.course.slug,
          startTime: scheduled.course.startTime,
          title: scheduled.course.title,
        },
        signedIn: Boolean(page.actor),
      };
    }
    return { kind: "missing" };
  });

const enroll = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; courseId: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { ok: false as const, error: page.error.message ?? "Sign in required" };
    }
    const result = await enrollInCourse(page.store, page.actor, data.courseId);
    if (!result.ok) {
      return { ok: false as const, error: result.error.message ?? result.error.code };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/courses/$slug")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const data = Route.useLoaderData();

  if (data.kind === "missing") {
    return (
      <section className="stack">
        <EmptyCard>Course not found.</EmptyCard>
        <a href={`/${tenant.slug}/courses`}>All courses</a>
      </section>
    );
  }

  if (data.kind === "scheduled") {
    const { course } = data;
    return (
      <section className="stack">
        <PageHeader
          actions={
            <a className="btn" href={`/${tenant.slug}/courses`}>
              All courses
            </a>
          }
          subtitle={new Date(course.startTime).toLocaleString()}
          title={course.title}
        />
        <div className="card stack">
          <p className="muted" style={{ margin: 0 }}>
            {course.isOnline ? "Online" : (course.location ?? "Location TBA")}
            {course.instructor ? ` · ${course.instructor}` : ""}
          </p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {course.description ?? "No description yet."}
          </p>
          {course.registrationUrl ? (
            <a className="btn btn-primary" href={course.registrationUrl} rel="noreferrer">
              Register
            </a>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Registration details coming soon.
            </p>
          )}
        </div>
      </section>
    );
  }

  return <SelfPacedCourse citySlug={tenant.slug} view={data} />;
}

function SelfPacedCourse({
  citySlug,
  view,
}: {
  citySlug: string;
  view: Extract<CourseView, { kind: "course" }>;
}) {
  const { course, signedIn } = view;
  const [enrolled, setEnrolled] = useState(course.enrolled);
  const [status, setStatus] = useState<string | null>(null);

  const handleEnroll = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = await enroll({ data: { citySlug, courseId: course.id } });
      if (result.ok) {
        setEnrolled(true);
        setStatus(null);
      } else {
        setStatus(result.error);
      }
    },
    [citySlug, course.id],
  );

  let enrollAction = <SignInCard href="/login" />;
  if (enrolled) {
    enrollAction = (
      <p className="muted" style={{ margin: 0 }}>
        You are enrolled.
      </p>
    );
  } else if (signedIn) {
    enrollAction = (
      <form onSubmit={handleEnroll}>
        <button className="btn btn-primary" type="submit">
          Enroll
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    );
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/courses`}>
            All courses
          </a>
        }
        subtitle={`${course.lessons.length} lessons · ${course.enrollmentCount} enrolled`}
        title={course.title}
      />
      <div className="card stack">
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {course.description ?? "No description yet."}
        </p>
        {enrollAction}
      </div>
      <ItemList
        empty="No lessons yet."
        items={course.lessons.map((lesson) => ({
          detail: lesson.content ?? undefined,
          id: lesson.id,
          title: lesson.title,
        }))}
      />
    </section>
  );
}
