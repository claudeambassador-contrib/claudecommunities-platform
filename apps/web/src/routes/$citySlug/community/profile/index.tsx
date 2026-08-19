import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getOwnProfile } from "@/modules/identity/services/usersService";
import { requireCityActor } from "@/shared/http/cityPage";
import { Avatar } from "@/shared/ui/avatar";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const profile = await getOwnProfile(page.registry, page.actor);
    if (!profile.ok) {
      return { signedIn: true as const, user: null };
    }
    return {
      signedIn: true as const,
      user: {
        email: profile.user.email,
        id: profile.user.id,
        imageUrl: profile.user.imageUrl,
        name: profile.user.displayName ?? profile.user.email,
        role: profile.user.role,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/community/profile/")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: OwnProfilePage,
});

function OwnProfilePage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  if (!data.user) {
    return <EmptyCard>Profile not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader subtitle={data.user.email} title={data.user.name} />
      <div className="card stack">
        <Avatar
          className="size-16 rounded-full"
          fallbackClassName="bg-accent text-white text-xl font-bold"
          name={data.user.name}
          src={data.user.imageUrl}
        />
        <p className="m-0">Role: {data.user.role ?? "member"}</p>
        <p className="muted m-0">
          <a href={`/${citySlug}/community/settings/profile`}>Profile settings</a>
        </p>
      </div>
    </section>
  );
}
