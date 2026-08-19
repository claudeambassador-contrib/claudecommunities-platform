import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { Block } from "@/modules/pages/types";
import type { RegionConfig } from "@/shared/region";

export interface HomeEventCard {
  id: string;
  slug: string;
  startTime: string | null;
  title: string;
}

export interface CmsBlocksProps {
  blocks: Block[];
  citySlug: string;
  events?: HomeEventCard[];
  region: RegionConfig;
  signedIn?: boolean;
}

export function CmsBlocks({
  blocks,
  citySlug,
  events = [],
  region,
  signedIn = false,
}: CmsBlocksProps): ReactElement {
  return (
    <section className="stack">
      {blocks
        .filter((block) => block.enabled)
        .map((block) => (
          <CmsBlock
            block={block}
            citySlug={citySlug}
            events={events}
            key={block.id}
            region={region}
            signedIn={signedIn}
          />
        ))}
    </section>
  );
}

function CmsBlock(props: {
  block: Block;
  citySlug: string;
  events: HomeEventCard[];
  region: RegionConfig;
  signedIn: boolean;
}): ReactElement | null {
  return renderCmsBlock(props);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one branch per CMS block type
function renderCmsBlock({
  block,
  citySlug,
  events,
  region,
  signedIn,
}: {
  block: Block;
  citySlug: string;
  events: HomeEventCard[];
  region: RegionConfig;
  signedIn: boolean;
}): ReactElement | null {
  const city = { citySlug };
  switch (block.type) {
    case "hero":
      return (
        <div className="card stack" key={block.id}>
          {block.badge ? <p className="muted">{block.badge}</p> : null}
          <h2 style={{ margin: 0 }}>{block.heading ?? `Welcome to ${region.siteName}`}</h2>
          {block.body ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{block.body}</p> : null}
          <div className="row">
            <Link className="btn btn-primary" params={city} to="/$citySlug/events">
              {block.primaryCtaLabel ?? "Browse events"}
            </Link>
            <Link className="btn" params={city} to="/$citySlug/community">
              Community
            </Link>
          </div>
        </div>
      );
    case "benefits":
      return (
        <div className="card stack" key={block.id}>
          <strong>{block.heading ?? "Why join"}</strong>
          {block.cards.map((card) => (
            <div key={card.title}>
              <strong>{card.title}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      );
    case "audienceSplit":
      return (
        <div className="card stack" key={block.id}>
          <strong>{block.heading ?? "Who it's for"}</strong>
          {block.subheading ? <p className="muted">{block.subheading}</p> : null}
          {block.cards.map((card) => (
            <a
              href={`/${citySlug}${card.href.startsWith("/") ? card.href : `/${card.href}`}`}
              key={card.title}
            >
              <strong>{card.title}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                {card.desc}
              </p>
              <span>{card.ctaLabel ?? "Learn more"}</span>
            </a>
          ))}
        </div>
      );
    case "events":
      return (
        <div className="card stack" key={block.id}>
          <strong>Upcoming events</strong>
          {events.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No events yet.
            </p>
          ) : (
            events.map((event) => (
              <Link
                key={event.id}
                params={{ citySlug, slug: event.slug }}
                to="/$citySlug/events/$slug"
              >
                <strong>{event.title}</strong>
                <div className="muted">
                  {event.startTime ? new Date(event.startTime).toLocaleString() : "TBA"}
                </div>
              </Link>
            ))
          )}
        </div>
      );
    case "discord":
      return (
        <div className="card stack" key={block.id}>
          <strong>Discord</strong>
          <p className="muted" style={{ margin: 0 }}>
            Chat lives on Discord for {region.siteName}.
          </p>
          <a className="btn btn-primary" href={region.discordInvite} rel="noreferrer">
            Join Discord
          </a>
        </div>
      );
    case "gallery":
      return (
        <div className="card stack" key={block.id}>
          <strong>{block.heading ?? "From recent meetups"}</strong>
          {block.subheading ? <p className="muted">{block.subheading}</p> : null}
          {region.galleryImages.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Photos land here after the next meetup.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {region.galleryImages.map((image) => (
                <li key={image.src}>{image.alt}</li>
              ))}
            </ul>
          )}
        </div>
      );
    case "cta":
      return (
        <div className="card stack" key={block.id}>
          <strong>
            {signedIn ? "You're in" : (block.headingSignedOut ?? "Join the community")}
          </strong>
          <p style={{ margin: 0 }}>
            {signedIn
              ? "Browse events, courses, and the member feed."
              : (block.bodySignedOut ?? "Sign in to RSVP, post, and follow along.")}
          </p>
          {signedIn ? (
            <Link className="btn btn-primary" params={city} to="/$citySlug/community">
              Open community
            </Link>
          ) : (
            <a className="btn btn-primary" href="/login">
              {block.ctaLabelSignedOut ?? "Community Login"}
            </a>
          )}
        </div>
      );
    case "richText":
      return (
        <div className="card stack" key={block.id}>
          {block.heading ? <strong>{block.heading}</strong> : null}
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{block.body}</p>
        </div>
      );
    case "webinar":
      return (
        <a className="card stack" href={block.href} key={block.id} rel="noreferrer">
          <strong>{block.title}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {block.description}
          </p>
        </a>
      );
    default:
      return null;
  }
}
