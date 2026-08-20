import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { listAllAdmin } from "@/modules/courses/services/coursesService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadCoursesInput = cityInput();

const loadCourses = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadCoursesInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const result = await listAllAdmin(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        courses: result.courses.map((course) => ({
          detail: `${course.status} · ${course.lessonCount} lessons`,
          href: `/${page.tenant.slug}/admin/courses/${course.id}/edit`,
          id: course.id,
          title: course.title,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/courses/")({
  loader: ({ params }) => loadCourses({ data: { citySlug: params.citySlug } }),
  component: AdminCoursesPage,
});

function AdminCoursesPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Courses" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/courses/new`}>
            New course
          </a>
        }
        title="Courses"
      />
      <ItemList empty="No courses yet." items={data.courses} />
    </section>
  );
}
