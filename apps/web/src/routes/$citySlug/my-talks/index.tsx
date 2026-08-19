import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listUserTalks } from "@/modules/talks/services/talksService";
import { requireCityActor } from "@/shared/http/cityPage";
import { ItemList, PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return {
        signedIn: false as const,
        talks: [] as { detail: string; href: string; id: string; title: string }[],
      };
    }
    const result = await listUserTalks(page.store, page.actor);
    return {
      signedIn: true as const,
      talks: result.ok
        ? result.talks.map((talk) => ({
            detail: `${talk.status} · ${new Date(talk.createdAt).toLocaleDateString()}`,
            href: `/${data.citySlug}/my-talks/${talk.id}`,
            id: talk.id,
            title: talk.title,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/my-talks/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { signedIn, talks } = Route.useLoaderData();

  if (!signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${tenant.slug}/speak`}>
            Submit a talk
          </a>
        }
        subtitle="Your speaker submissions for this city."
        title="My talks"
      />
      <ItemList empty="You have not submitted a talk yet." items={talks} />
    </section>
  );
}
