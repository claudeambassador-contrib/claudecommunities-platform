import type React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getRegionConfig } from "@/lib/region";

// ── Brand tokens ──────────────────────────────────────────────
const CORAL = "#D4836A";
const CORAL_LIGHT = "#E09880";
const DARK = "#1C1917";
const DARK_CARD = "#2D2926";
const DARK_LIGHTER = "#292524";
const CREAM = "#FAF9F6";
const TEXT_SECONDARY = "#A8A29E";
const BLUE = "#60A5FA";
const GREEN = "#4ADE80";
const PURPLE = "#A78BFA";

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// ── Helpers ───────────────────────────────────────────────────
function useFadeSlideIn(delay = 0, direction: "up" | "down" | "left" | "right" = "up") {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dist = 50;
  const translate = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 80, stiffness: 120, mass: 0.6 },
  });

  const map: Record<string, string> = {
    up: `translateY(${(1 - translate) * dist}px)`,
    down: `translateY(${(translate - 1) * dist}px)`,
    left: `translateX(${(1 - translate) * dist}px)`,
    right: `translateX(${(translate - 1) * dist}px)`,
  };

  return { opacity, transform: map[direction] };
}

function useFadeOut(startAt: number, duration = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startAt, startAt + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ── Browser Chrome Component ──────────────────────────────────
const BrowserChrome: React.FC<{
  url: string;
  children: React.ReactNode;
  scale?: number;
}> = ({ url, children, scale = 1 }) => {
  const frame = useCurrentFrame();
  const charCount = Math.min(
    url.length,
    Math.floor(
      interpolate(frame, [5, 30], [0, url.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const typedUrl = url.slice(0, charCount);
  const showCursor = frame < 35 && frame % 12 < 8;

  return (
    <div
      style={{
        width: 1600 * scale,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        border: `1px solid #3a3632`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          backgroundColor: "#2D2926",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#ef4444" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#22c55e" }} />
        </div>
        {/* URL bar */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#1C1917",
            borderRadius: 8,
            padding: "8px 16px",
            marginLeft: 12,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 15 * scale,
              color: TEXT_SECONDARY,
            }}
          >
            {typedUrl}
            {showCursor && <span style={{ color: CORAL }}>|</span>}
          </span>
        </div>
      </div>
      {/* Content */}
      <div
        style={{
          backgroundColor: DARK,
          minHeight: 700 * scale,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ── Scene 1: Browser Opens ────────────────────────────────────
const BrowserOpen: React.FC = () => {
  const { countryName } = getRegionConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const browserScale = spring({
    frame,
    fps,
    config: { damping: 60, stiffness: 70, mass: 0.8 },
  });

  const fadeOut = useFadeOut(100);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${CORAL}15 0%, transparent 70%)`,
        }}
      />

      <div style={{ transform: `scale(${browserScale * 0.95})` }}>
        <BrowserChrome url={getRegionConfig().senderDomain}>
          {/* Mock hero */}
          <div style={{ padding: "60px 80px" }}>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 20,
                fontWeight: 600,
                color: CORAL_LIGHT,
                letterSpacing: 3,
                textTransform: "uppercase",
                ...useFadeSlideIn(35),
              }}
            >
              Claude Code Community
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 64,
                fontWeight: 800,
                color: CREAM,
                lineHeight: 1.15,
                marginTop: 16,
                maxWidth: 900,
                ...useFadeSlideIn(45),
              }}
            >
              {`${countryName}'s ${getRegionConfig().communitySuperlative}Claude Code community`}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 24,
                color: TEXT_SECONDARY,
                marginTop: 20,
                maxWidth: 700,
                lineHeight: 1.5,
                ...useFadeSlideIn(55),
              }}
            >
              {`Meetups, courses, co-work sessions and hackathons for AI-powered developers and creators across ${countryName}.`}
            </div>
            {/* Mock buttons */}
            <div style={{ display: "flex", gap: 16, marginTop: 36, ...useFadeSlideIn(65) }}>
              <div
                style={{
                  backgroundColor: CORAL,
                  padding: "16px 40px",
                  borderRadius: 50,
                  fontFamily: FONT,
                  fontSize: 20,
                  fontWeight: 700,
                  color: CREAM,
                }}
              >
                Join the Community
              </div>
              <div
                style={{
                  border: `2px solid ${TEXT_SECONDARY}55`,
                  padding: "16px 40px",
                  borderRadius: 50,
                  fontFamily: FONT,
                  fontSize: 20,
                  fontWeight: 600,
                  color: TEXT_SECONDARY,
                }}
              >
                View Events
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Page Showcase Cards ──────────────────────────────
const PageCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  color: string;
  delay: number;
  mockContent: React.ReactNode;
}> = ({ title, description, icon, color, delay, mockContent }) => {
  const style = useFadeSlideIn(delay, "up");

  return (
    <div
      style={{
        ...style,
        width: 460,
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${color}30`,
        backgroundColor: DARK_CARD,
      }}
    >
      {/* Mock page preview */}
      <div
        style={{
          height: 220,
          backgroundColor: DARK_LIGHTER,
          padding: 24,
          borderBottom: `2px solid ${color}20`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {mockContent}
      </div>
      {/* Label */}
      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 26,
              fontWeight: 700,
              color: CREAM,
            }}
          >
            {title}
          </span>
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 18,
            color: TEXT_SECONDARY,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

// Mini mock content for page cards
const EventsMock: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {["Sydney Meetup — Mar 28", "Melbourne Workshop — Apr 2", "Brisbane Co-work — Apr 5"].map(
      (ev) => (
        <div
          key={ev}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: `${BLUE}12`,
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: BLUE,
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: FONT, fontSize: 16, color: CREAM, fontWeight: 500 }}>
            {ev}
          </span>
        </div>
      ),
    )}
  </div>
);

const CoursesMock: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div
      style={{
        backgroundColor: `${GREEN}15`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 17, color: CREAM, fontWeight: 600 }}>
        Claude Cowork for Beginners
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            style={{
              width: 52,
              height: 6,
              borderRadius: 3,
              backgroundColor: n <= 3 ? GREEN : `${GREEN}30`,
            }}
          />
        ))}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 13, color: TEXT_SECONDARY, marginTop: 6 }}>
        3 of 5 lessons complete
      </div>
    </div>
    <div
      style={{
        backgroundColor: `${PURPLE}12`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 17, color: CREAM, fontWeight: 600 }}>
        Advanced Prompting Workshop
      </div>
      <div style={{ fontFamily: FONT, fontSize: 13, color: PURPLE, marginTop: 6, fontWeight: 500 }}>
        Upcoming &bull; 2 hours
      </div>
    </div>
  </div>
);

const CoworkMock: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: `${CORAL}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        💻
      </div>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 17, color: CREAM, fontWeight: 600 }}>
          Focused Work Block
        </div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: TEXT_SECONDARY }}>
          45 min deep work session
        </div>
      </div>
    </div>
    <div
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: `${CORAL}20`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "65%",
          height: "100%",
          borderRadius: 4,
          backgroundColor: CORAL,
        }}
      />
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {["Side project", "Learning", "Open source", "Prototyping"].map((tag) => (
        <span
          key={tag}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: CORAL_LIGHT,
            backgroundColor: `${CORAL}15`,
            padding: "5px 12px",
            borderRadius: 20,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  </div>
);

const PagesShowcase: React.FC = () => {
  const { countryName } = getRegionConfig();
  const fadeOut = useFadeOut(110);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 600,
          color: TEXT_SECONDARY,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 40,
          textAlign: "center",
          ...useFadeSlideIn(0),
        }}
      >
        Explore the platform
      </div>
      <div style={{ display: "flex", gap: 32 }}>
        <PageCard
          title="Events"
          description={`Meetups, workshops, and hackathons across ${countryName}`}
          icon="📅"
          color={BLUE}
          delay={10}
          mockContent={<EventsMock />}
        />
        <PageCard
          title="Courses"
          description="Self-paced lessons and scheduled workshops"
          icon="🎓"
          color={GREEN}
          delay={22}
          mockContent={<CoursesMock />}
        />
        <PageCard
          title="Co-work"
          description="Focused building sessions, side-by-side"
          icon="💻"
          color={CORAL}
          delay={34}
          mockContent={<CoworkMock />}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Two Tracks ───────────────────────────────────────
const TrackCard: React.FC<{
  title: string;
  emoji: string;
  subtitle: string;
  features: string[];
  color: string;
  delay: number;
  direction: "left" | "right";
}> = ({ title, emoji, subtitle, features, color, delay, direction }) => {
  const style = useFadeSlideIn(delay, direction);

  return (
    <div
      style={{
        ...style,
        width: 740,
        backgroundColor: DARK_CARD,
        borderRadius: 28,
        padding: "44px 48px",
        borderLeft: direction === "left" ? `5px solid ${color}` : "none",
        borderRight: direction === "right" ? `5px solid ${color}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
        <span style={{ fontSize: 40 }}>{emoji}</span>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 40,
            fontWeight: 800,
            color: CREAM,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 22,
          color,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {features.map((f, i) => (
          <div
            key={f}
            style={{
              fontFamily: FONT,
              fontSize: 24,
              color: TEXT_SECONDARY,
              display: "flex",
              alignItems: "center",
              gap: 12,
              ...useFadeSlideIn(delay + 15 + i * 8, "up"),
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
};

const TwoTracks: React.FC = () => {
  const fadeOut = useFadeOut(110);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 600,
          color: TEXT_SECONDARY,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 40,
          textAlign: "center",
          ...useFadeSlideIn(0),
        }}
      >
        For everyone
      </div>
      <div style={{ display: "flex", gap: 36 }}>
        <TrackCard
          title="Professional Devs"
          emoji="⚙️"
          subtitle="Engineers & tech leads"
          features={[
            "Production Claude Code workflows",
            "CI/CD integration patterns",
            "Advanced prompting techniques",
          ]}
          color={BLUE}
          delay={8}
          direction="left"
        />
        <TrackCard
          title="Vibe Coders"
          emoji="✨"
          subtitle="Creators & entrepreneurs"
          features={[
            "No coding experience needed",
            "Build apps by describing them",
            "Websites, tools & prototypes",
          ]}
          color={GREEN}
          delay={18}
          direction="right"
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: Pricing Tiers ────────────────────────────────────
const PriceTier: React.FC<{
  name: string;
  price: string;
  period: string;
  features: string[];
  color: string;
  highlighted?: boolean;
  delay: number;
}> = ({ name, price, period, features, color, highlighted, delay }) => {
  const style = useFadeSlideIn(delay, "up");

  return (
    <div
      style={{
        ...style,
        width: 440,
        backgroundColor: highlighted ? `${color}12` : DARK_CARD,
        borderRadius: 28,
        padding: "44px 40px",
        border: highlighted ? `2px solid ${color}50` : `1px solid #3a363255`,
        position: "relative",
      }}
    >
      {highlighted && (
        <div
          style={{
            position: "absolute",
            top: -1,
            left: 60,
            right: 60,
            height: 4,
            backgroundColor: color,
            borderRadius: "0 0 4px 4px",
          }}
        />
      )}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: 3,
          marginBottom: 16,
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 64,
            fontWeight: 900,
            color: CREAM,
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 22,
            color: TEXT_SECONDARY,
          }}
        >
          {period}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 1,
          backgroundColor: `${TEXT_SECONDARY}30`,
          marginBottom: 24,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {features.map((f) => (
          <div
            key={f}
            style={{
              fontFamily: FONT,
              fontSize: 20,
              color: TEXT_SECONDARY,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ color, fontSize: 18 }}>✓</span>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
};

const Pricing: React.FC = () => {
  const fadeOut = useFadeOut(105);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 600,
          color: TEXT_SECONDARY,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 40,
          textAlign: "center",
          ...useFadeSlideIn(0),
        }}
      >
        Simple pricing
      </div>
      <div style={{ display: "flex", gap: 28 }}>
        <PriceTier
          name="Free"
          price="$0"
          period=""
          features={["Community feed & discussions", "Attend free events", "Basic profile"]}
          color={TEXT_SECONDARY}
          delay={8}
        />
        <PriceTier
          name="Pro"
          price="$19"
          period="/mo"
          features={["All courses included", "Priority event access", "Pro badge & DMs"]}
          color={CORAL}
          highlighted
          delay={18}
        />
        <PriceTier
          name="Team"
          price="$49"
          period="/mo"
          features={["Team workspace", "Custom training", "Dedicated support"]}
          color={PURPLE}
          delay={28}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: CTA ──────────────────────────────────────────────
const FinalCTA: React.FC = () => {
  const { countryName } = getRegionConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = Math.sin(frame * 0.08) * 0.03 + 1;

  const buttonScale = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 50, stiffness: 80, mass: 0.6 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Dual glow */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${CORAL}25 0%, transparent 70%)`,
          transform: `scale(${pulse})`,
          left: "25%",
          top: "20%",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BLUE}15 0%, transparent 70%)`,
          transform: `scale(${pulse * 1.05})`,
          right: "20%",
          bottom: "15%",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 72,
            fontWeight: 800,
            color: CREAM,
            lineHeight: 1.2,
            ...useFadeSlideIn(5),
          }}
        >
          Start building with us
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 28,
            color: TEXT_SECONDARY,
            marginTop: 16,
            ...useFadeSlideIn(15),
          }}
        >
          {`Free to join • All skill levels • Across ${countryName}`}
        </div>

        {/* Button */}
        <div
          style={{
            marginTop: 44,
            display: "inline-flex",
            backgroundColor: CORAL,
            padding: "22px 60px",
            borderRadius: 60,
            transform: `scale(${buttonScale})`,
            boxShadow: `0 0 60px ${CORAL}40`,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 34,
              fontWeight: 700,
              color: CREAM,
            }}
          >
            {getRegionConfig().senderDomain}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Main Composition ──────────────────────────────────────────
export const WebsiteTour: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {/* Scene 1: Browser opens with homepage (0–120) */}
      <Sequence from={0} durationInFrames={130}>
        <BrowserOpen />
      </Sequence>

      {/* Scene 2: Page showcase cards (120–250) */}
      <Sequence from={120} durationInFrames={135}>
        <PagesShowcase />
      </Sequence>

      {/* Scene 3: Two tracks (245–375) */}
      <Sequence from={245} durationInFrames={135}>
        <TwoTracks />
      </Sequence>

      {/* Scene 4: Pricing (370–490) */}
      <Sequence from={370} durationInFrames={125}>
        <Pricing />
      </Sequence>

      {/* Scene 5: CTA (485–600) */}
      <Sequence from={485} durationInFrames={115}>
        <FinalCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
