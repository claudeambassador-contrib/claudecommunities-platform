import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listPublicTenants } from "@/modules/tenants/services/publicListService";
import { isClerkPublishableConfigured } from "@/shared/auth/clerk";

const getDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const result = await listPublicTenants();
  if (!result.ok) {
    return { tenants: [] as { slug: string; name: string }[] };
  }
  return { tenants: result.tenants };
});

export const Route = createFileRoute("/")({
  loader: () => getDirectory(),
  component: PlatformHome,
});

function PlatformHome() {
  const { tenants } = Route.useLoaderData();

  return (
    <main className="shell stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>Claude Communities</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Platform directory — each city runs on its own D1 instance.
          </p>
        </div>
        <div className="row">
          {isClerkPublishableConfigured() ? (
            <>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="btn" type="button">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn btn-primary" type="button">
                    Sign up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </>
          ) : (
            <Link className="btn btn-primary" to="/login">
              Sign in
            </Link>
          )}
          <Link className="btn" to="/api/health">
            Health
          </Link>
        </div>
      </header>

      <section className="stack">
        <h2 style={{ margin: 0 }}>Cities</h2>
        {tenants.length === 0 ? (
          <div className="card muted">
            No cities provisioned yet. Run{" "}
            <code>bun run db:provision:city -- sydney &quot;Sydney&quot;</code> locally.
          </div>
        ) : (
          <div className="stack">
            {tenants.map((t) => (
              <Link
                className="card"
                key={t.slug}
                params={{ citySlug: t.slug }}
                style={{ display: "block" }}
                to="/$citySlug"
              >
                <strong>{t.name}</strong>
                <div className="muted">/{t.slug}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
