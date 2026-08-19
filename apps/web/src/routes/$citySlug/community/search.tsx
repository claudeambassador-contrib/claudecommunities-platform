import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listFeed } from "@/modules/community/services/communityService";
import { listDirectory } from "@/modules/identity/services/usersService";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, ItemList, PageHeader } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; q: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { members: [], posts: [] as { id: string; title: string }[], signedIn: false };
    }
    const q = data.q.trim().toLowerCase();
    if (!q) {
      return {
        members: [],
        posts: [] as { id: string; title: string }[],
        signedIn: Boolean(page.actor),
      };
    }
    const feed = await listFeed(page.store, { viewer: page.actor });
    const posts = (feed.ok ? feed.posts : [])
      .filter((post) => {
        const title = post.title?.toLowerCase() ?? "";
        return title.includes(q) || post.content.toLowerCase().includes(q);
      })
      .map((post) => ({
        id: post.id,
        title: post.title?.trim() || post.content.slice(0, 80) || "Untitled post",
      }));
    if (!page.actor) {
      return { members: [], posts, signedIn: false };
    }
    const directory = await listDirectory(page.registry, page.actor, page.tenant.orgId, {
      search: data.q.trim(),
    });
    return {
      members: directory.ok
        ? directory.users.map((user) => ({
            id: user.id,
            name: user.displayName?.trim() || "Member",
          }))
        : [],
      posts,
      signedIn: true,
    };
  });

export const Route = createFileRoute("/$citySlug/community/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: String(s.q ?? "") }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps, params }) => load({ data: { citySlug: params.citySlug, q: deps.q } }),
  component: SearchPage,
});

function SearchPage() {
  const { citySlug } = Route.useParams();
  const { q } = Route.useSearch();
  const { members, posts, signedIn } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader subtitle="Search posts and members" title="Search" />
      <form action={`/${citySlug}/community/search`} className="card stack" method="get">
        <input className="btn" defaultValue={q} name="q" placeholder="Search…" type="search" />
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>
      {q.trim() ? (
        <>
          <h3 style={{ margin: 0 }}>Posts</h3>
          <ItemList
            empty={`No posts match “${q}”.`}
            items={posts.map((post) => ({
              href: `/${citySlug}/community/posts/${post.id}`,
              id: post.id,
              title: post.title,
            }))}
          />
          <h3 style={{ margin: 0 }}>Members</h3>
          <ItemList
            empty={signedIn ? `No members match “${q}”.` : "Sign in to search members."}
            items={members.map((member) => ({
              href: `/${citySlug}/community/profile/${member.id}`,
              id: member.id,
              title: member.name,
            }))}
          />
        </>
      ) : (
        <EmptyCard>Enter a search term to find posts and members.</EmptyCard>
      )}
    </section>
  );
}
