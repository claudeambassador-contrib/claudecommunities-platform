import { SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { isClerkPublishableConfigured } from "@/shared/auth/clerk";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Sign In" }, { name: "robots", content: "noindex, follow" }],
  }),
});

function LoginPage() {
  return (
    <main className="shell stack" style={{ maxWidth: "28rem", paddingTop: "4rem" }}>
      <div>
        <h1 style={{ margin: 0 }}>Welcome back</h1>
        <p className="muted">Sign in to your account</p>
      </div>
      {isClerkPublishableConfigured() ? (
        <SignIn fallbackRedirectUrl="/" />
      ) : (
        <div className="card">
          <p style={{ margin: 0 }}>
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
