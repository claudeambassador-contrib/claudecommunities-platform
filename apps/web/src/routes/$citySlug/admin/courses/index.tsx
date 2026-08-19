import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listAllAdmin } from "@/modules/courses/services/coursesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadCourses = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listAllAdmin(page.store, page.actor);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      courses: result.courses.map((course) => ({
        detail: `${course.status} · ${course.lessonCount} lessons`,
        href: `/${page.tenant.slug}/admin/courses/${course.id}/edit`,
        id: course.id,
        title: course.title,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/courses/")({
  loader: ({ params }) => loadCourses({ data: { citySlug: params.citySlug } }),
  component: AdminCoursesPage,
});

function AdminCoursesPage() {
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
