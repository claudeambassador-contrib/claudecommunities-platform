import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listPublished } from "@/modules/courses/services/coursesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ItemList, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        courses: [] as { id: string; lessonCount: number; slug: string; title: string }[],
      };
    }
    const result = await listPublished(page.store);
    return {
      courses: result.ok
        ? result.courses.map((course) => ({
            id: course.id,
            lessonCount: course.lessonCount,
            slug: course.slug,
            title: course.title,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/community/learn/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: LearnPage,
});

function LearnPage() {
  const { citySlug } = Route.useParams();
  const { courses } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader subtitle="Published courses" title="Learn" />
      <ItemList
        empty="No published courses yet."
        items={courses.map((course) => ({
          detail: `${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}`,
          href: `/${citySlug}/community/learn/${course.slug}`,
          id: course.id,
          title: course.title,
        }))}
      />
    </section>
  );
}
