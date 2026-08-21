import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { listPublished, listPublishedScheduled } from "@/modules/courses/services/coursesService";
import { loadCityPage } from "@/shared/http/cityPage";
import { ItemList, PageHeader } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        courses: [] as {
          detail: string;
          href: string;
          id: string;
          title: string;
        }[],
        scheduled: [] as {
          detail: string;
          href: string;
          id: string;
          title: string;
        }[],
      };
    }
    const [published, scheduled] = await Promise.all([
      listPublished(page.store),
      listPublishedScheduled(page.store),
    ]);
    const href = (slug: string) => `/${data.citySlug}/courses/${slug}`;
    return {
      courses: published.ok
        ? published.courses.map((course) => ({
            detail: `${course.lessonCount} lessons · ${course.enrollmentCount} enrolled`,
            href: href(course.slug),
            id: course.id,
            title: course.title,
          }))
        : [],
      scheduled: scheduled.ok
        ? scheduled.courses.map((course) => ({
            detail: [
              new Date(course.startTime).toLocaleString(),
              course.location ?? course.city,
              course.isOnline ? "Online" : null,
            ]
              .filter(Boolean)
              .join(" · "),
            href: href(course.slug),
            id: course.id,
            title: course.title,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/courses/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  staleTime: 30_000,
  component: Page,
});

function Page(): ReactElement {
  const { courses, scheduled } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader
        subtitle="Self-paced modules and scheduled workshops."
        title="Courses & workshops"
      />
      <div className="card">
        <strong>Self-paced</strong>
      </div>
      <ItemList empty="No published courses yet." items={courses} />
      <div className="card">
        <strong>Scheduled workshops</strong>
      </div>
      <ItemList empty="No scheduled workshops yet." items={scheduled} />
    </section>
  );
}
