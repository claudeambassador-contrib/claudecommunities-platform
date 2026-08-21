import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

export const Route = createFileRoute("/signup/sso-callback")({
  component: SsoCallbackPage,
});

function SsoCallbackPage(): ReactElement {
  return (
    <main className="shell">
      <div className="card muted">Completing sign up…</div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
    </main>
  );
}
