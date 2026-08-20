import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getCourse } from "@/modules/courses/services/coursesService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadCourseInput = cityInput({ id: z.string() });

const loadCourse = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadCourseInput.parse(input))
  .handler(
    cityHandler(async (page, data) => {
      const result = await getCourse(page.store, data.id, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        course: {
          description: result.course.description,
          id: result.course.id,
          lessonCount: result.course.lessons.length,
          slug: result.course.slug,
          status: result.course.status,
          title: result.course.title,
        },
      });
    }, "courses.view"),
  );

export const Route = createFileRoute("/$citySlug/admin/courses/$id/edit")({
  loader: ({ params }) => loadCourse({ data: { citySlug: params.citySlug, id: params.id } }),
  component: EditCoursePage,
});

function EditCoursePage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Edit course" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/courses`}>
            Back
          </a>
        }
        subtitle={`/${data.course.slug} · ${data.course.status}`}
        title={data.course.title}
      />
      <div className="card stack">
        <p className="whitespace-pre-wrap">{data.course.description ?? "No description yet."}</p>
        <p className="muted">{data.course.lessonCount} lessons</p>
      </div>
    </section>
  );
}
