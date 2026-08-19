import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getRegionConfig } from "@/shared/region";

const CORAL = "#D4836A";
const DARK = "#1C1917";
const CREAM = "#FAF9F6";
const MUTED = "#A8A29E";
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame - delay, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = spring({
    config: { damping: 80, mass: 0.6, stiffness: 120 },
    fps,
    frame: Math.max(0, frame - delay),
  });
  return {
    opacity,
    transform: `translateY(${(1 - progress) * 36}px)`,
  };
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }): ReactElement {
  return (
    <div
      style={{
        background: "#292524",
        border: "1px solid rgb(255 255 255 / 0.08)",
        borderRadius: 24,
        padding: 48,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TitleCard({ subtitle, title }: { subtitle: string; title: string }): ReactElement {
  const enter = useEnter();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ ...enter, maxWidth: 1400, textAlign: "center" }}>
        <div style={{ color: CORAL, fontFamily: FONT, fontSize: 28, letterSpacing: 4 }}>
          WEBSITE TOUR
        </div>
        <h1 style={{ color: CREAM, fontFamily: FONT, fontSize: 92, margin: "16px 0" }}>{title}</h1>
        <p style={{ color: MUTED, fontFamily: FONT, fontSize: 36, margin: 0 }}>{subtitle}</p>
      </div>
    </AbsoluteFill>
  );
}

function FeatureCard({ body, heading }: { body: string; heading: string }): ReactElement {
  const enter = useEnter(6);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <Card style={{ ...enter, maxWidth: 1200 }}>
        <h2 style={{ color: CREAM, fontFamily: FONT, fontSize: 64, margin: "0 0 16px" }}>
          {heading}
        </h2>
        <p style={{ color: MUTED, fontFamily: FONT, fontSize: 32, margin: 0 }}>{body}</p>
      </Card>
    </AbsoluteFill>
  );
}

export function WebsiteTour(): ReactElement {
  const { communitySuperlative, countryName, senderDomain, siteName } = getRegionConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      <Sequence durationInFrames={90} from={0}>
        <TitleCard
          subtitle={`${countryName}'s ${communitySuperlative}Claude Code community`}
          title={siteName}
        />
      </Sequence>
      <Sequence durationInFrames={120} from={90}>
        <FeatureCard
          body="Each city is its own tenant — events, community, and admin stay scoped."
          heading="City homes"
        />
      </Sequence>
      <Sequence durationInFrames={120} from={210}>
        <FeatureCard
          body="Meetups, workshops, and RSVPs with a published agenda."
          heading="Events"
        />
      </Sequence>
      <Sequence durationInFrames={120} from={330}>
        <FeatureCard
          body="Members, posts, courses, and a leaderboard — sign in to participate."
          heading="Community"
        />
      </Sequence>
      <Sequence durationInFrames={150} from={450}>
        <TitleCard subtitle={senderDomain} title="See you at the next meetup" />
      </Sequence>
    </AbsoluteFill>
  );
}
