import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { PageHeader } from "@/shared/ui/page";

export const Route = createFileRoute("/$citySlug/community/guidelines")({
  component: GuidelinesPage,
});

function GuidelinesPage(): ReactElement {
  return (
    <section className="stack">
      <PageHeader subtitle="How we treat each other here" title="Community guidelines" />
      <div className="card stack">
        <p className="m-0">
          <strong>Be kind.</strong> Assume good faith. Disagree with ideas, not people.
        </p>
        <p className="m-0">
          <strong>No spam.</strong> Don&apos;t flood the feed or scrape members for outreach.
        </p>
        <p className="m-0">
          <strong>No harassment.</strong> Personal attacks, pile-ons, and hate are not welcome.
        </p>
      </div>
    </section>
  );
}
