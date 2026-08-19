import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getPublishedBySlug } from "@/modules/courses/services/coursesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, ItemList, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { course: null };
    }
    const found = await getPublishedBySlug(page.store, data.slug, page.actor);
    if (!found.ok) {
      return { course: null };
    }
    return {
      course: {
        description: found.course.description,
        id: found.course.id,
        lessons: found.course.lessons.map((lesson) => ({
          id: lesson.id,
          order: lesson.order,
          title: lesson.title,
        })),
        slug: found.course.slug,
        title: found.course.title,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/community/learn/$slug/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: CoursePage,
});

function CoursePage() {
  const { citySlug } = Route.useParams();
  const { course } = Route.useLoaderData();

  if (!course) {
    return <EmptyCard>Course not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader subtitle={course.description ?? undefined} title={course.title} />
      <ItemList
        empty="No lessons yet."
        items={course.lessons.map((lesson) => ({
          detail: `Lesson ${lesson.order + 1}`,
          href: `/${citySlug}/community/learn/${course.slug}/${lesson.id}`,
          id: lesson.id,
          title: lesson.title,
        }))}
      />
    </section>
  );
}
