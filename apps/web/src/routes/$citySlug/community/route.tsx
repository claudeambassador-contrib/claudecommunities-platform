import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listSpaces } from "@/modules/community/services/communityService";
import { loadCityPage } from "@/shared/http/cityPage";

const loadCommunityInput = z.object({ citySlug: z.string().min(1) });

const loadCommunity = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadCommunityInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { signedIn: false, spaces: [] as { name: string; slug: string }[] };
    }
    const spaces = await listSpaces(page.store);
    return {
      signedIn: Boolean(page.auth),
      spaces: spaces.ok ? spaces.spaces.map((s) => ({ name: s.name, slug: s.slug })) : [],
    };
  });

export const Route = createFileRoute("/$citySlug/community")({
  beforeLoad: async ({ params }) => loadCommunity({ data: { citySlug: params.citySlug } }),
  component: CommunityLayout,
});

function CommunityLayout(): ReactElement {
  const { citySlug } = Route.useParams();
  const { signedIn, spaces } = Route.useRouteContext();
  const city = { citySlug };

  return (
    <div className="stack">
      <nav className="city-subnav">
        <Link params={city} to="/$citySlug/community">
          Feed
        </Link>
        <Link params={city} to="/$citySlug/community/members">
          Members
        </Link>
        <Link params={city} search={{ q: "" }} to="/$citySlug/community/search">
          Search
        </Link>
        <Link params={city} to="/$citySlug/community/learn">
          Learn
        </Link>
        <Link params={city} to="/$citySlug/community/leaderboard">
          Leaderboard
        </Link>
        {signedIn ? (
          <>
            <Link params={city} to="/$citySlug/community/bookmarks">
              Bookmarks
            </Link>
            <Link params={city} to="/$citySlug/community/notifications">
              Notifications
            </Link>
            <Link params={city} to="/$citySlug/community/connections">
              Connections
            </Link>
            <Link params={city} to="/$citySlug/community/profile">
              Profile
            </Link>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>
      {spaces.length > 0 ? (
        <p className="muted">Spaces: {spaces.map((s) => s.name).join(" · ")}</p>
      ) : null}
      <Outlet />
    </div>
  );
}
