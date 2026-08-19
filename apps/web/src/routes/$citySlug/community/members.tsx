import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listDirectory } from "@/modules/identity/services/usersService";
import { requireCityActor } from "@/shared/http/cityPage";
import { Avatar } from "@/shared/ui/avatar";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const directory = await listDirectory(page.registry, page.actor, page.tenant.orgId);
    return {
      signedIn: true as const,
      members: directory.ok
        ? directory.users.map((user) => ({
            id: user.id,
            imageUrl: user.imageUrl,
            name: user.displayName?.trim() || "Member",
            role: user.role,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/community/members")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: MembersPage,
});

function MembersPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="People in this city" title="Members" />
      {data.members.length === 0 ? (
        <EmptyCard>No members yet.</EmptyCard>
      ) : (
        <div className="stack">
          {data.members.map((member) => (
            <Link
              className="card row"
              key={member.id}
              params={{ citySlug, id: member.id }}
              style={{ display: "flex" }}
              to="/$citySlug/community/profile/$id"
            >
              <Avatar
                className="size-10 rounded-full"
                fallbackClassName="bg-[#D4836A] text-white font-semibold"
                name={member.name}
                src={member.imageUrl}
              />
              <div>
                <strong>{member.name}</strong>
                <div className="muted">{member.role ?? "member"}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
