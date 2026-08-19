import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  actions?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle ? (
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function EmptyCard({ children }: { children: ReactNode }) {
  return <div className="card muted">{children}</div>;
}

export function DeniedCard({
  title = "Access denied",
  reason,
}: {
  reason?: string | null;
  title?: string;
}) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="muted">{reason ?? "You do not have permission to view this page."}</p>
    </div>
  );
}

export function SignInCard({ href = "/login" }: { href?: string }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Sign in required</h2>
      <p className="muted">
        <a href={href}>Sign in</a> to continue.
      </p>
    </div>
  );
}

export function ItemList({
  items,
  empty,
}: {
  empty: string;
  items: Array<{ detail?: string; href?: string; id: string; title: string }>;
}) {
  if (items.length === 0) {
    return <EmptyCard>{empty}</EmptyCard>;
  }
  return (
    <div className="stack">
      {items.map((item) => {
        const body = (
          <>
            <strong>{item.title}</strong>
            {item.detail ? <div className="muted">{item.detail}</div> : null}
          </>
        );
        if (item.href) {
          return (
            <a className="card" href={item.href} key={item.id} style={{ display: "block" }}>
              {body}
            </a>
          );
        }
        return (
          <article className="card" key={item.id}>
            {body}
          </article>
        );
      })}
    </div>
  );
}
