import { SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { isClerkPublishableConfigured } from "@/shared/auth/clerk";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Sign In" }, { name: "robots", content: "noindex, follow" }],
  }),
});

function LoginPage(): ReactElement {
  return (
    <main className="shell shell-narrow stack">
      <div>
        <h1 className="m-0">Welcome back</h1>
        <p className="muted">Sign in to your account</p>
      </div>
      {isClerkPublishableConfigured() ? (
        <SignIn fallbackRedirectUrl="/" />
      ) : (
        <div className="card">
          <p className="m-0">
            Clerk keys are not configured. Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> and{" "}
            <code>CLERK_SECRET_KEY</code> to <code>apps/web/.env.local</code>, allow{" "}
            <code>http://localhost:3001</code>, then reload.
          </p>
        </div>
      )}
      <p className="muted">
        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
      </p>
    </main>
  );
}
