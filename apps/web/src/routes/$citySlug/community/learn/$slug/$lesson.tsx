import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getPublishedBySlug } from "@/modules/courses/services/coursesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; lesson: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { course: null, lesson: null };
    }
    const found = await getPublishedBySlug(page.store, data.slug, page.actor);
    if (!found.ok) {
      return { course: null, lesson: null };
    }
    const lesson = found.course.lessons.find((item) => item.id === data.lesson);
    if (!lesson) {
      return {
        course: { slug: found.course.slug, title: found.course.title },
        lesson: null,
      };
    }
    return {
      course: { slug: found.course.slug, title: found.course.title },
      lesson: {
        content: lesson.content,
        id: lesson.id,
        title: lesson.title,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/community/learn/$slug/$lesson")({
  loader: ({ params }) =>
    load({
      data: { citySlug: params.citySlug, lesson: params.lesson, slug: params.slug },
    }),
  component: LessonPage,
});

function LessonPage() {
  const { citySlug } = Route.useParams();
  const { course, lesson } = Route.useLoaderData();

  if (!course) {
    return <EmptyCard>Course not found.</EmptyCard>;
  }

  if (!lesson) {
    return (
      <section className="stack">
        <PageHeader title={course.title} />
        <EmptyCard>Lesson not found.</EmptyCard>
      </section>
    );
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/community/learn/${course.slug}`}>
            Back to course
          </a>
        }
        subtitle={course.title}
        title={lesson.title}
      />
      <div className="card">
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {lesson.content ?? "No lesson content yet."}
        </p>
      </div>
    </section>
  );
}
