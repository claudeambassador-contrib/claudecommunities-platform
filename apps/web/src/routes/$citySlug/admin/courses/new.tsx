import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { createCourse } from "@/modules/courses/services/coursesService";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import type { Mutated } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadNewCourseInput = cityInput();

const loadNewCourse = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadNewCourseInput.parse(input))
  .handler(cityHandler(async () => ok({}), "courses.edit"));

const submitCourseInput = cityInput({
  slug: z.string(),
  title: z.string(),
});

const submitCourse = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitCourseInput.parse(input))
  .handler(
    cityMutationHandler(async (page, data) => {
      const result = await createCourse(page.store, page.actor, {
        slug: data.slug,
        title: data.title,
      });
      if (!result.ok) {
        return result;
      }
      return ok({ id: result.course.id });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/courses/new")({
  loader: ({ params }) => loadNewCourse({ data: { citySlug: params.citySlug } }),
  component: NewCoursePage,
});

function NewCoursePage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="New course" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/courses`}>
            Back
          </a>
        }
        title="New course"
      />
      <CourseForm citySlug={citySlug} />
    </section>
  );
}

function CourseForm({ citySlug }: { citySlug: string }): ReactElement {
  const navigate = useNavigate();
  const { error, handleSubmit, pending, success } = useFormSubmit<Mutated<{ id: string }>>({
    onSuccess: async (result) => {
      await navigate({
        params: { citySlug, id: result.id },
        to: "/$citySlug/admin/courses/$id/edit",
      });
    },
    submit: (fd) =>
      submitCourse({
        data: {
          citySlug,
          slug: formString(fd, "slug"),
          title: formString(fd, "title"),
        },
      }),
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Title
        <input className="field" name="title" required />
      </label>
      <label className="field-label">
        Slug
        <input className="field" name="slug" required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create course"}
      </button>
    </form>
  );
}
