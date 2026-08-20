import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { listPublicTenants } from "@/modules/tenants/services/publicListService";
import { isClerkPublishableConfigured } from "@/shared/auth/clerk";
import { loadRegistryPage } from "@/shared/http/registryPage";

const getDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const { registry } = await loadRegistryPage();
  const result = await listPublicTenants(registry.db);
  if (!result.ok) {
    return { tenants: [] as { slug: string; name: string }[] };
  }
  return { tenants: result.tenants };
});

export const Route = createFileRoute("/")({
  loader: () => getDirectory(),
  staleTime: 60_000,
  component: PlatformHome,
});

function PlatformHome(): ReactElement {
  const { tenants } = Route.useLoaderData();

  return (
    <main className="shell stack">
      <header className="row justify-between">
        <div>
          <h1 className="m-0">Claude Communities</h1>
          <p className="muted mt-1">Platform directory — each city runs on its own D1 instance.</p>
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
        <h2 className="m-0">Cities</h2>
        {tenants.length === 0 ? (
          <div className="card muted">
            No cities provisioned yet. Run{" "}
            <code>bun run db:provision:city -- sydney &quot;Sydney&quot;</code> locally.
          </div>
        ) : (
          <div className="stack">
            {tenants.map((t) => (
              <Link
                className="card block"
                key={t.slug}
                params={{ citySlug: t.slug }}
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
