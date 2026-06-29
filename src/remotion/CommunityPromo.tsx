import type React from "react";
import {
  AbsoluteFill,
  Easing,
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

  const dist = 60;
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

// ── Scene 1: Coral Splash ─────────────────────────────────────
const CoralSplash: React.FC = () => {
  const { countryName } = getRegionConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const circleScale = spring({
    frame,
    fps,
    config: { damping: 60, stiffness: 80, mass: 0.8 },
  });

  const textStyle = useFadeSlideIn(15);
  const subStyle = useFadeSlideIn(30);
  const fadeOut = useFadeOut(70);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      {/* Expanding coral circle */}
      <div
        style={{
          position: "absolute",
          width: 2400,
          height: 2400,
          borderRadius: "50%",
          backgroundColor: CORAL,
          transform: `scale(${circleScale})`,
          opacity: 0.15,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          backgroundColor: CORAL,
          transform: `scale(${circleScale})`,
          opacity: 0.25,
        }}
      />

      {/* Logo text */}
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 42,
            fontWeight: 600,
            color: CORAL_LIGHT,
            letterSpacing: 8,
            textTransform: "uppercase",
            ...textStyle,
          }}
        >
          Claude Code
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 110,
            fontWeight: 800,
            color: CREAM,
            lineHeight: 1.1,
            marginTop: -5,
            ...subStyle,
          }}
        >
          Community
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 36,
            fontWeight: 500,
            color: TEXT_SECONDARY,
            letterSpacing: 6,
            marginTop: 12,
            ...useFadeSlideIn(40),
          }}
        >
          {countryName}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Tagline ──────────────────────────────────────────
const Tagline: React.FC = () => {
  const { countryName } = getRegionConfig();
  const frame = useCurrentFrame();

  const words = ["Meetups.", "Courses.", "Community."];
  const fadeOut = useFadeOut(85);

  // Animated underline
  const lineWidth = interpolate(frame, [30, 60], [0, 600], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 56,
            fontWeight: 500,
            color: TEXT_SECONDARY,
            ...useFadeSlideIn(5),
          }}
        >
          {`${countryName}'s growing network of`}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 80,
            fontWeight: 800,
            color: CREAM,
            marginTop: 10,
            ...useFadeSlideIn(15),
          }}
        >
          AI&#8209;powered developers
        </div>

        {/* Coral underline */}
        <div
          style={{
            width: lineWidth,
            height: 5,
            backgroundColor: CORAL,
            margin: "20px auto",
            borderRadius: 3,
          }}
        />

        {/* Word trio */}
        <div style={{ display: "flex", gap: 50, justifyContent: "center", marginTop: 20 }}>
          {words.map((word, i) => (
            <div
              key={word}
              style={{
                fontFamily: FONT,
                fontSize: 48,
                fontWeight: 700,
                color: CORAL_LIGHT,
                ...useFadeSlideIn(35 + i * 10),
              }}
            >
              {word}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Feature Cards ────────────────────────────────────
const FeatureCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  delay: number;
}> = ({ icon, title, subtitle, color, delay }) => {
  const style = useFadeSlideIn(delay, "up");

  return (
    <div
      style={{
        ...style,
        backgroundColor: DARK_CARD,
        borderRadius: 24,
        padding: "40px 36px",
        width: 380,
        border: `2px solid ${color}22`,
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: 700,
          color: CREAM,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 22,
          color: TEXT_SECONDARY,
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

const Features: React.FC = () => {
  const fadeOut = useFadeOut(100);

  const cards = [
    {
      icon: "🤝",
      title: "Meetups",
      subtitle: "Connect with local devs across 8+ cities",
      color: CORAL,
    },
    { icon: "🎓", title: "Courses", subtitle: "Hands-on workshops and bootcamps", color: BLUE },
    {
      icon: "💻",
      title: "Co-work",
      subtitle: "Build side-by-side in focused sessions",
      color: GREEN,
    },
    {
      icon: "⚡",
      title: "Hackathons",
      subtitle: "Ship fast, learn faster, win prizes",
      color: PURPLE,
    },
  ];

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
        What we do
      </div>
      <div style={{ display: "flex", gap: 28 }}>
        {cards.map((c, i) => (
          <FeatureCard key={c.title} {...c} delay={10 + i * 12} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: Two Pathways ─────────────────────────────────────
const PathCard: React.FC<{
  title: string;
  subtitle: string;
  points: string[];
  color: string;
  delay: number;
  direction: "left" | "right";
}> = ({ title, subtitle, points, color, delay, direction }) => {
  const style = useFadeSlideIn(delay, direction);

  return (
    <div
      style={{
        ...style,
        backgroundColor: DARK_CARD,
        borderRadius: 32,
        padding: "50px 56px",
        width: 780,
        borderTop: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 44,
          fontWeight: 800,
          color: CREAM,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 24,
          color,
          marginBottom: 24,
          fontWeight: 600,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {points.map((p, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static animation list of fixed copy strings, never reordered
            key={i}
            style={{
              fontFamily: FONT,
              fontSize: 26,
              color: TEXT_SECONDARY,
              ...useFadeSlideIn(delay + 15 + i * 8, "up"),
            }}
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
};

const TwoPathways: React.FC = () => {
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
        Two pathways, one community
      </div>
      <div style={{ display: "flex", gap: 40 }}>
        <PathCard
          title="Professional Devs"
          subtitle="Software engineers & tech leads"
          points={[
            "→  Production Claude Code workflows",
            "→  Architecture & CI/CD integration",
            "→  Advanced prompting techniques",
          ]}
          color={BLUE}
          delay={10}
          direction="left"
        />
        <PathCard
          title="Vibe Coders"
          subtitle="Creators & entrepreneurs"
          points={[
            "→  No coding experience needed",
            "→  Build apps by describing them",
            "→  Websites, tools & prototypes",
          ]}
          color={GREEN}
          delay={20}
          direction="right"
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: Cities (fast looping ticker) ─────────────────────
const CITIES_ROW_1 = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Canberra",
  "Hobart",
  "Darwin",
  "Gold Coast",
  "Newcastle",
  "Sunshine Coast",
  "Geelong",
  "Wollongong",
  "Townsville",
];
const CITIES_ROW_2 = [
  "Adelaide",
  "Townsville",
  "Sydney",
  "Geelong",
  "Darwin",
  "Brisbane",
  "Wollongong",
  "Perth",
  "Hobart",
  "Melbourne",
  "Newcastle",
  "Canberra",
  "Gold Coast",
  "Sunshine Coast",
];
// Triple the list so it's wide enough to loop seamlessly
const ROW_1 = [...CITIES_ROW_1, ...CITIES_ROW_1, ...CITIES_ROW_1];
const ROW_2 = [...CITIES_ROW_2, ...CITIES_ROW_2, ...CITIES_ROW_2];

const CITY_GAP = 48;
const CITY_W = 320; // approx width per city block
const STRIP_W = CITIES_ROW_1.length * (CITY_W + CITY_GAP);

const CityRow: React.FC<{
  cities: string[];
  speed: number; // px per frame
  offset: number; // starting x offset
  highlight: boolean;
  big: boolean;
}> = ({ cities, speed, offset, highlight, big }) => {
  const frame = useCurrentFrame();

  // Continuous scroll that wraps using modulo
  const rawX = offset - frame * speed;
  const x = (((rawX % STRIP_W) + STRIP_W) % STRIP_W) - STRIP_W;

  return (
    <div style={{ overflow: "hidden", width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: CITY_GAP,
          transform: `translateX(${x}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {cities.map((city, i) => {
          const isCapital = [
            "Sydney",
            "Melbourne",
            "Brisbane",
            "Perth",
            "Adelaide",
            "Canberra",
            "Hobart",
            "Darwin",
          ].includes(city);
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: marquee row may repeat the same city, so index disambiguates a static, never-reordered list
              key={`${city}-${i}`}
              style={{
                fontFamily: FONT,
                fontSize: big ? 68 : 52,
                fontWeight: isCapital ? 800 : 500,
                color:
                  isCapital && highlight ? CREAM : `${TEXT_SECONDARY}${isCapital ? "cc" : "88"}`,
                padding: "8px 20px",
                borderRadius: 14,
                backgroundColor: isCapital && highlight ? `${CORAL}18` : "transparent",
                flexShrink: 0,
                minWidth: CITY_W - CITY_GAP,
                textAlign: "center",
              }}
            >
              {city}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Cities: React.FC = () => {
  const { countryName } = getRegionConfig();
  const fadeOut = useFadeOut(90);

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
          marginBottom: 50,
          textAlign: "center",
          ...useFadeSlideIn(0),
        }}
      >
        {`Meetups across ${countryName}`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
        {/* Row 1: scrolls left, fast */}
        <CityRow cities={ROW_1} speed={18} offset={0} highlight big />
        {/* Row 2: scrolls right (negative speed), slightly slower */}
        <CityRow cities={ROW_2} speed={-14} offset={-STRIP_W / 2} highlight={false} big={false} />
      </div>

      {/* Subtle gradient overlays on edges */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 200,
          background: `linear-gradient(to right, ${DARK}, transparent)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 200,
          background: `linear-gradient(to left, ${DARK}, transparent)`,
          zIndex: 2,
        }}
      />
    </AbsoluteFill>
  );
};

// ── Scene 6: Stats ────────────────────────────────────────────
const StatBlock: React.FC<{
  number: string;
  label: string;
  color: string;
  delay: number;
}> = ({ number, label, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 60, stiffness: 100, mass: 0.5 },
  });

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ textAlign: "center", opacity, transform: `scale(${scale})` }}>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 96,
          fontWeight: 900,
          color,
          lineHeight: 1,
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 500,
          color: TEXT_SECONDARY,
          marginTop: 12,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Stats: React.FC = () => {
  const fadeOut = useFadeOut(80);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div style={{ display: "flex", gap: 120 }}>
        <StatBlock number="500+" label="Developers" color={CORAL_LIGHT} delay={5} />
        <StatBlock number="10x" label="Faster iteration" color={BLUE} delay={15} />
        <StatBlock number="8+" label="Cities" color={GREEN} delay={25} />
        <StatBlock number="85%" label="Changed their workflow" color={PURPLE} delay={35} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 7: CTA ──────────────────────────────────────────────
const CallToAction: React.FC = () => {
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
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${CORAL}30 0%, transparent 70%)`,
          transform: `scale(${pulse})`,
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 80,
            fontWeight: 800,
            color: CREAM,
            lineHeight: 1.2,
            ...useFadeSlideIn(5),
          }}
        >
          Ready to join?
        </div>

        {/* Button */}
        <div
          style={{
            marginTop: 40,
            display: "inline-flex",
            backgroundColor: CORAL,
            padding: "24px 64px",
            borderRadius: 60,
            transform: `scale(${buttonScale})`,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 36,
              fontWeight: 700,
              color: CREAM,
            }}
          >
            {getRegionConfig().senderDomain}
          </span>
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontSize: 26,
            color: TEXT_SECONDARY,
            marginTop: 30,
            ...useFadeSlideIn(40),
          }}
        >
          Free to join &bull; All skill levels welcome
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Main Composition ──────────────────────────────────────────
export const CommunityPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {/* Scene 1: Coral splash intro (0–90) */}
      <Sequence from={0} durationInFrames={100}>
        <CoralSplash />
      </Sequence>

      {/* Scene 2: Tagline (85–195) */}
      <Sequence from={85} durationInFrames={120}>
        <Tagline />
      </Sequence>

      {/* Scene 3: Feature cards (190–310) */}
      <Sequence from={190} durationInFrames={125}>
        <Features />
      </Sequence>

      {/* Scene 4: Two pathways (305–430) */}
      <Sequence from={305} durationInFrames={130}>
        <TwoPathways />
      </Sequence>

      {/* Scene 5: Cities (425–535) */}
      <Sequence from={425} durationInFrames={115}>
        <Cities />
      </Sequence>

      {/* Scene 6: Stats (530–630) */}
      <Sequence from={530} durationInFrames={105}>
        <Stats />
      </Sequence>

      {/* Scene 7: CTA (625–720) */}
      <Sequence from={625} durationInFrames={95}>
        <CallToAction />
      </Sequence>
    </AbsoluteFill>
  );
};
