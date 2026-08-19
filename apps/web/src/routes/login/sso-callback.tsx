import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login/sso-callback")({
  component: SsoCallbackPage,
});

function SsoCallbackPage() {
  return (
    <main className="shell">
      <div className="card muted">Completing sign in…</div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
    </main>
  );
}
