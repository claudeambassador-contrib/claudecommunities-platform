import { Link, useRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useCallback } from "react";

/** Router-wide pending fallback (defaultPendingComponent). */
export function RoutePending(): ReactElement {
  return (
    <main aria-busy="true" className="shell stack">
      <div className="card stack">
        <p className="muted m-0">Loading…</p>
      </div>
    </main>
  );
}

/** Router-wide not-found fallback (defaultNotFoundComponent). */
export function RouteNotFound(): ReactElement {
  return (
    <main className="shell stack">
      <div className="card stack">
        <h1 className="m-0">Page not found</h1>
        <p className="muted m-0">That page does not exist or may have moved.</p>
        <div className="row">
          <Link className="btn btn-primary" to="/">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Router-wide error fallback (defaultErrorComponent). The root route keeps
 *  its own errorComponent with Clerk-outage handling. */
export function RouteError({ error }: { error: Error }): ReactElement {
  const router = useRouter();
  const message = error.message || "Something went wrong";

  const handleRetry = useCallback(() => {
    router.invalidate();
  }, [router]);

  return (
    <main className="shell stack">
      <div className="card stack">
        <h1 className="m-0">Page failed</h1>
        <p className="muted m-0">{message}</p>
        <div className="row">
          <button className="btn btn-primary" onClick={handleRetry} type="button">
            Retry
          </button>
          <Link className="btn" to="/">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
