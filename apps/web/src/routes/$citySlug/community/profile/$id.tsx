import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getOwnProfile, listDirectory } from "@/modules/identity/services/usersService";
import { requireCityActor } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; id: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    if (data.id === page.actor.id) {
      const own = await getOwnProfile(page.registry, page.actor);
      if (!own.ok) {
        return { signedIn: true as const, user: null };
      }
      return {
        signedIn: true as const,
        user: {
          email: own.user.email,
          id: own.user.id,
          name: own.user.displayName ?? own.user.email,
          role: own.user.role,
        },
      };
    }
    const directory = await listDirectory(page.registry, page.actor, page.tenant.orgId, {
      limit: 100,
    });
    const found = directory.ok ? directory.users.find((user) => user.id === data.id) : undefined;
    if (!found) {
      return { signedIn: true as const, user: null };
    }
    return {
      signedIn: true as const,
      user: {
        email: null,
        id: found.id,
        name: found.displayName?.trim() || "Member",
        role: found.role,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/community/profile/$id")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, id: params.id } }),
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  if (!data.user) {
    return <EmptyCard>Member not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle={data.user.email ?? (data.user.role ? `Role: ${data.user.role}` : undefined)}
        title={data.user.name}
      />
      <div className="card">
        <p style={{ margin: 0 }}>Role: {data.user.role ?? "member"}</p>
      </div>
    </section>
  );
}
