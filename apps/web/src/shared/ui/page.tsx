import type { ReactElement, ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  actions?: ReactNode;
  subtitle?: string;
  title: string;
}): ReactElement {
  return (
    <div className="row justify-between">
      <div>
        <h2 className="m-0">{title}</h2>
        {subtitle ? <p className="muted mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function EmptyCard({ children }: { children: ReactNode }): ReactElement {
  return <div className="card muted">{children}</div>;
}

export function DeniedCard({
  title = "Access denied",
  reason,
}: {
  reason?: string | null;
  title?: string;
}): ReactElement {
  return (
    <div className="card">
      <h2 className="mt-0">{title}</h2>
      <p className="muted">{reason ?? "You do not have permission to view this page."}</p>
    </div>
  );
}

export function SignInCard({ href = "/login" }: { href?: string }): ReactElement {
  return (
    <div className="card">
      <h2 className="mt-0">Sign in required</h2>
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
}): ReactElement {
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
            <a className="card block" href={item.href} key={item.id}>
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
