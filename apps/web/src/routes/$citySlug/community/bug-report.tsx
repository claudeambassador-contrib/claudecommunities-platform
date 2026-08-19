import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent, ReactElement } from "react";
import { PageHeader } from "@/shared/ui/page";

export const Route = createFileRoute("/$citySlug/community/bug-report")({
  component: BugReportPage,
});

function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

function BugReportPage(): ReactElement {
  return (
    <section className="stack">
      <PageHeader subtitle="Reports go to the maintainers" title="Report a bug" />
      <form className="card stack" onSubmit={handleSubmit}>
        <p className="muted m-0">
          This form is not connected to a backend. Copy your notes and send them to the maintainers.
        </p>
        <label className="stack">
          Title
          <input className="btn" name="title" placeholder="Brief description" required />
        </label>
        <label className="stack">
          Description
          <textarea className="btn" name="description" placeholder="What happened?" rows={4} />
        </label>
        <label className="stack">
          Steps to reproduce
          <textarea className="btn" name="steps" placeholder="1. Go to…" rows={3} />
        </label>
        <button className="btn btn-primary" type="submit">
          Copy for maintainers
        </button>
      </form>
    </section>
  );
}
