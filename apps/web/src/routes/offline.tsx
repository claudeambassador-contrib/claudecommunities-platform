import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
  head: () => ({ meta: [{ title: "You're Offline" }] }),
});

function reloadPage() {
  window.location.reload();
}

function OfflinePage() {
  return (
    <main className="shell stack" style={{ maxWidth: "28rem", paddingTop: "4rem" }}>
      <h1 style={{ margin: 0 }}>You&apos;re offline</h1>
      <p className="muted">
        It looks like you&apos;ve lost your internet connection. Some features may be unavailable
        until you&apos;re back online.
      </p>
      <button className="btn btn-primary" onClick={reloadPage} type="button">
        Try again
      </button>
      <div className="card stack">
        <strong>While you&apos;re offline</strong>
        <p className="muted" style={{ margin: 0 }}>
          Previously viewed posts and courses may still be available. Drafts sync when you
          reconnect.
        </p>
      </div>
    </main>
  );
}
