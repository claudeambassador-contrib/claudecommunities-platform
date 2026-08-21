import { ClerkProvider } from "@clerk/tanstack-react-start";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";

import { isClerkPublishableConfigured } from "@/shared/auth/clerk";

import appCss from "../styles.css?url";

const AUTH_OUTAGE = /clerk|publishable key|jwks|handshake/i;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Claude Communities" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  errorComponent: RootError,
  shellComponent: RootDocument,
});

function RootComponent(): ReactElement {
  return <Outlet />;
}

function RootError({ error }: { error: Error }): ReactElement {
  const router = useRouter();
  const message = error.message || "Something went wrong";
  const authOutage = AUTH_OUTAGE.test(message);
  const title = authOutage ? "Sign-in is unavailable" : "Page failed";
  const detail = authOutage
    ? "Authentication is not configured or Clerk could not complete a handshake. Public pages should still load — try again, or set VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/web/.env.local."
    : message;

  const handleRetry = useCallback(() => {
    router.invalidate();
  }, [router]);

  return (
    <main className="shell stack">
      <div className="card stack">
        <h1 className="m-0">{title}</h1>
        <p className="muted m-0">{detail}</p>
        <div className="row">
          <button className="btn btn-primary" onClick={handleRetry} type="button">
            Retry
          </button>
          <a className="btn" href="/">
            Home
          </a>
        </div>
      </div>
    </main>
  );
}

function RootDocument({ children }: { children: ReactNode }): ReactElement {
  if (isClerkPublishableConfigured()) {
    return (
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <ClerkProvider>{children}</ClerkProvider>
          <Scripts />
        </body>
      </html>
    );
  }
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
