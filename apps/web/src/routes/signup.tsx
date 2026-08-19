import { SignUp } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { isClerkPublishableConfigured } from "@/shared/auth/clerk";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [{ title: "Sign Up" }, { name: "robots", content: "noindex, follow" }],
  }),
});

function SignupPage(): ReactElement {
  return (
    <main className="shell shell-narrow stack">
      <div>
        <h1 className="m-0">Join the community</h1>
        <p className="muted">Create your account to get started</p>
      </div>
      {isClerkPublishableConfigured() ? (
        <SignUp fallbackRedirectUrl="/" />
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
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
