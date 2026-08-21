import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useState } from "react";
import { z } from "zod";

import {
  enrollInCourse,
  getPublishedBySlug,
  getScheduledCourse,
} from "@/modules/courses/services/coursesService";
import { cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, ItemList, PageHeader, SignInCard } from "@/shared/ui/page";
import { useFormSubmit } from "@/shared/ui/use-form-submit";

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

const loadInput = z.object({ citySlug: z.string().min(1), slug: z.string() });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
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

const enrollInput = cityInput({ courseId: z.string() });

const enroll = createServerFn({ method: "POST" })
  .validator((input: unknown) => enrollInput.parse(input))
  .handler(
    cityMutationHandler((page, data) => enrollInCourse(page.store, page.actor, data.courseId)),
  );

export const Route = createFileRoute("/$citySlug/courses/$slug")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: Page,
});

function Page(): ReactElement {
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
          <p className="muted m-0">
            {course.isOnline ? "Online" : (course.location ?? "Location TBA")}
            {course.instructor ? ` · ${course.instructor}` : ""}
          </p>
          <p className="m-0 whitespace-pre-wrap">{course.description ?? "No description yet."}</p>
          {course.registrationUrl ? (
            <a className="btn btn-primary" href={course.registrationUrl} rel="noreferrer">
              Register
            </a>
          ) : (
            <p className="muted m-0">Registration details coming soon.</p>
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
}): ReactElement {
  const { course, signedIn } = view;
  const [enrolled, setEnrolled] = useState(course.enrolled);
  const { error, handleSubmit, pending } = useFormSubmit({
    invalidate: false,
    onSuccess: () => {
      setEnrolled(true);
    },
    submit: () => enroll({ data: { citySlug, courseId: course.id } }),
  });

  let enrollAction = <SignInCard href="/login" />;
  if (enrolled) {
    enrollAction = <p className="muted m-0">You are enrolled.</p>;
  } else if (signedIn) {
    enrollAction = (
      <form onSubmit={handleSubmit}>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Enrolling…" : "Enroll"}
        </button>
        {error ? <p className="form-error">{error}</p> : null}
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
        <p className="m-0 whitespace-pre-wrap">{course.description ?? "No description yet."}</p>
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
