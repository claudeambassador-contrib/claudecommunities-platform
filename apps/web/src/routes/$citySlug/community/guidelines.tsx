import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/shared/ui/page";

export const Route = createFileRoute("/$citySlug/community/guidelines")({
  component: GuidelinesPage,
});

function GuidelinesPage() {
  return (
    <section className="stack">
      <PageHeader subtitle="How we treat each other here" title="Community guidelines" />
      <div className="card stack">
        <p style={{ margin: 0 }}>
          <strong>Be kind.</strong> Assume good faith. Disagree with ideas, not people.
        </p>
        <p style={{ margin: 0 }}>
          <strong>No spam.</strong> Don&apos;t flood the feed or scrape members for outreach.
        </p>
        <p style={{ margin: 0 }}>
          <strong>No harassment.</strong> Personal attacks, pile-ons, and hate are not welcome.
        </p>
      </div>
    </section>
  );
}
